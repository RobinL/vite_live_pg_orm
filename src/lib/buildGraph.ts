import { parse } from 'pgsql-ast-parser';

export interface ForeignKey {
    fromTable: string;
    fromCols: string[];
    toTable: string;
    toCols: string[];
}
export interface Table {
    name: string;
    columns: string[];
    primaryKey: string[];
    fks: ForeignKey[];
}
export interface SchemaGraph { tables: Record<string, Table> }

export function buildGraphFromDDL(ddl: string): SchemaGraph {
    const ast = parse(ddl);
    const tables: Record<string, Table> = {};

    // 1) CREATE TABLE → columns
    for (const stmt of ast) {
        if ((stmt as any).type === 'create table') {
            const name = (stmt as any).name?.name ?? '';
            if (!name) continue;
            const cols = ((stmt as any).columns ?? [])
                .filter((c: any) => c?.name?.name)
                .map((c: any) => String(c.name.name));
            const prev = tables[name];
            tables[name] = {
                name,
                columns: prev ? Array.from(new Set([...prev.columns, ...cols])) : cols,
                primaryKey: prev?.primaryKey ?? [],
                fks: prev?.fks ?? [],
            };
        }
    }

    // 2) ALTER TABLE … ADD CONSTRAINT … PRIMARY/FOREIGN KEY
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

    const stripQ = (s: string) => s.replace(/^public\./, '').replace(/"/g, '');
    const splitCols = (g: string) => g.split(',').map(s => s.trim().replace(/"/g, '')).filter(Boolean);

    const pkRe = /ALTER TABLE ONLY\s+public\.([a-zA-Z0-9_\"]+)\s+ADD CONSTRAINT\s+([a-zA-Z0-9_\"]+)\s+PRIMARY KEY\s*\(([^)]+)\)\s*;/i;
    const fkRe = /ALTER TABLE ONLY\s+public\.([a-zA-Z0-9_\"]+)\s+ADD CONSTRAINT\s+([a-zA-Z0-9_\"]+)\s+FOREIGN KEY\s*\(([^)]+)\)\s+REFERENCES\s+public\.([a-zA-Z0-9_\"]+)\s*\(([^)]+)\)\s*;/i;

    for (const st of statements) {
        let m = st.match(pkRe);
        if (m) {
            const t = stripQ(m[1]);
            tables[t] ??= { name: t, columns: [], primaryKey: [], fks: [] };
            tables[t].primaryKey = splitCols(m[3]);
            continue;
        }
        m = st.match(fkRe);
        if (m) {
            const fromTable = stripQ(m[1]);
            const fromCols = splitCols(m[3]);
            const toTable = stripQ(m[4]);
            const toCols = splitCols(m[5]);
            tables[fromTable] ??= { name: fromTable, columns: [], primaryKey: [], fks: [] };
            tables[fromTable].fks.push({ fromTable, fromCols, toTable, toCols });
            continue;
        }
    }

    return { tables };
}
