import { parse } from 'pgsql-ast-parser';
import type { SchemaGraph, Table, ForeignKey } from './types';
import { normalize } from './idents';

export function buildGraphFromDDL(ddl: string): SchemaGraph {
    const ast = parse(ddl);
    const tables: Record<string, Table> = {};

    const ensureTable = (qualified: string, source?: Partial<Table>): Table => {
        const norm = normalize(qualified);
        const existing = tables[norm];
        if (existing) {
            // update qualifiedName if not set
            if (!existing.qualifiedName) existing.qualifiedName = qualified;
            return existing;
        }
        const t: Table = {
            name: norm,
            qualifiedName: qualified,
            columns: [],
            primaryKey: [],
            fks: [],
            ...source,
        } as Table;
        tables[norm] = t;
        return t;
    };

    // 1) CREATE TABLE → columns (and inline constraints if present)
    for (const stmt of ast as any[]) {
        if (stmt?.type === 'create table') {
            const schema = stmt.name?.schema ? String(stmt.name.schema) : undefined;
            const rawName = stmt.name?.name ? String(stmt.name.name) : '';
            if (!rawName) continue;
            const qualified = schema ? `${schema}.${rawName}` : rawName;
            const t = ensureTable(qualified);
            const cols = (stmt.columns ?? [])
                .filter((c: any) => c?.name?.name)
                .map((c: any) => normalize(String(c.name.name)));
            // merge columns uniquely
            const set = new Set<string>([...t.columns, ...cols]);
            t.columns = Array.from(set);

            // Inline table constraints (optional; Northwind uses ALTER TABLE)
            for (const c of stmt.constraints ?? []) {
                if (c?.type === 'primary key') {
                    const pkCols = (c.columns ?? []).map((x: any) => normalize(String(x.name)));
                    t.primaryKey = Array.from(new Set(pkCols));
                }
                if (c?.type === 'foreign key') {
                    const fromCols = (c.columns ?? []).map((x: any) => normalize(String(x.name)));
                    const ref = c.references;
                    const refSchema = ref?.name?.schema ? String(ref.name.schema) : undefined;
                    const refName = ref?.name?.name ? String(ref.name.name) : '';
                    if (!refName) continue;
                    const toTable = normalize(refSchema ? `${refSchema}.${refName}` : refName);
                    const toCols = (ref.columns ?? []).map((x: any) => normalize(String(x.name)));
                    const fk: ForeignKey = { fromTable: t.name, fromCols, toTable, toCols };
                    t.fks.push(fk);
                }
            }
        }
    }

    // 2) ALTER TABLE … ADD CONSTRAINT … PRIMARY/FOREIGN KEY (regex fallback for pg_dump)
    const statements: string[] = [];
    {
        let buf = '';
        for (const ln of ddl.split('\n')) {
            buf += ln + ' ';
            if (ln.trim().endsWith(';')) {
                statements.push(buf.replace(/\s+/g, ' ').trim());
                buf = '';
            }
        }
    }

    const splitCols = (g: string) => g.split(',').map(s => normalize(s.trim()));
    // make schema optional and allow quoted idents
    const pkRe = /ALTER TABLE ONLY\s+(?:public\.)?"?([a-zA-Z0-9_]+)"?\s+ADD CONSTRAINT\s+"?([a-zA-Z0-9_]+)"?\s+PRIMARY KEY\s*\(([^)]+)\)\s*;/i;
    const fkRe = /ALTER TABLE ONLY\s+(?:public\.)?"?([a-zA-Z0-9_]+)"?\s+ADD CONSTRAINT\s+"?([a-zA-Z0-9_]+)"?\s+FOREIGN KEY\s*\(([^)]+)\)\s+REFERENCES\s+(?:public\.)?"?([a-zA-Z0-9_]+)"?\s*\(([^)]+)\)\s*;/i;

    for (const st of statements) {
        let m = st.match(pkRe);
        if (m) {
            const qualified = m[1];
            const t = ensureTable(qualified);
            t.primaryKey = Array.from(new Set(splitCols(m[3])));
            continue;
        }
        m = st.match(fkRe);
        if (m) {
            const fromQualified = m[1];
            const constraintName = m[2];
            const fromCols = splitCols(m[3]);
            const toQualified = m[4];
            const toCols = splitCols(m[5]);
            const fromTable = normalize(fromQualified);
            const toTable = normalize(toQualified);
            const t = ensureTable(fromQualified);
            const fk: ForeignKey = { fromTable, fromCols, toTable, toCols, constraintName } as ForeignKey;
            t.fks.push(fk);
            continue;
        }
    }

    // 3) Deterministic sorting and stats
    let fkCount = 0;
    for (const t of Object.values(tables)) {
        t.columns = [...new Set(t.columns)].sort();
        t.primaryKey = [...new Set(t.primaryKey)].sort();
        t.fks = t.fks.sort((a, b) => {
            return a.fromTable.localeCompare(b.fromTable)
                || a.toTable.localeCompare(b.toTable)
                || a.fromCols.join(',').localeCompare(b.fromCols.join(','))
                || a.toCols.join(',').localeCompare(b.toCols.join(','))
                || (a.constraintName || '').localeCompare(b.constraintName || '');
        });
        fkCount += t.fks.length;
    }

    const graph: SchemaGraph = {
        tables,
        stats: { tableCount: Object.keys(tables).length, fkCount },
    };
    return graph;
}
