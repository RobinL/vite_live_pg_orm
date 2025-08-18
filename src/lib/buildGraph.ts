/* eslint-disable @typescript-eslint/no-explicit-any */
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
        else if (stmt?.type === 'alter table') {
            // Robustly read schema-qualified table name
            const tbl = (stmt as any).table ?? {};
            // Support both {schema, name} and nested shapes
            const schema = tbl.schema ? String(tbl.schema) : (tbl.name?.schema ? String(tbl.name.schema) : undefined);
            const rawName = tbl.name ? String(tbl.name) : (tbl.name?.name ? String(tbl.name.name) : '');
            if (!rawName) continue;
            const qualified = schema ? `${schema}.${rawName}` : rawName;
            const t = ensureTable(qualified);

            const changes = Array.isArray((stmt as any).changes) ? (stmt as any).changes : [];
            for (const ch of changes) {
                if (!ch || ch.type !== 'add constraint') continue;
                const cons = ch.constraint ?? ch;
                const ctype = cons?.type;

                // PRIMARY KEY
                if (ctype === 'primary key') {
                    const colsU = cons.columns ?? cons.localColumns ?? [];
                    const cols = (Array.isArray(colsU) ? colsU : [])
                        .map((x: any) => x?.name ?? x)
                        .filter(Boolean)
                        .map((s: string) => normalize(String(s)));
                    t.primaryKey = Array.from(new Set(cols));
                    continue;
                }

                // FOREIGN KEY
                if (ctype === 'foreign key') {
                    // local columns
                    const fromU = cons.localColumns ?? cons.columns ?? [];
                    const fromCols = (Array.isArray(fromU) ? fromU : [])
                        .map((x: any) => x?.name ?? x)
                        .filter(Boolean)
                        .map((s: string) => normalize(String(s)));

                    // referenced table + columns; accept both shapes
                    const ref = cons.references ?? cons;
                    const refTbl = ref.foreignTable ?? ref.table ?? ref.name ?? {};
                    const refSchema = refTbl.schema ? String(refTbl.schema) : (refTbl.name?.schema ? String(refTbl.name.schema) : undefined);
                    const refName = refTbl.name ? String(refTbl.name) : (refTbl.name?.name ? String(refTbl.name.name) : (typeof refTbl === 'string' ? refTbl : ''));
                    if (!refName) continue;

                    const toQualified = refSchema ? `${refSchema}.${refName}` : refName;

                    const toU = ref.foreignColumns ?? ref.columns ?? [];
                    const toCols = (Array.isArray(toU) ? toU : [])
                        .map((x: any) => x?.name ?? x)
                        .filter(Boolean)
                        .map((s: string) => normalize(String(s)));

                    const fk: ForeignKey = {
                        fromTable: normalize(qualified),
                        fromCols,
                        toTable: normalize(toQualified),
                        toCols,
                        constraintName: cons.name?.name ? String(cons.name.name) : undefined,
                    };
                    t.fks.push(fk);
                    continue;
                }
            }
        }
    }

    // 3) Deterministic sorting and stats
    let fkCount = 0;
    for (const t of Object.values(tables)) {
        t.columns = [...new Set(t.columns)].sort();
        t.primaryKey = [...new Set(t.primaryKey)].sort();
        t.fks = t.fks.sort((a, b) =>
            a.fromTable.localeCompare(b.fromTable)
            || a.toTable.localeCompare(b.toTable)
            || a.fromCols.join(',').localeCompare(b.fromCols.join(','))
            || a.toCols.join(',').localeCompare(b.toCols.join(','))
        );
        fkCount += t.fks.length;
    }

    const graph: SchemaGraph = {
        tables,
        stats: { tableCount: Object.keys(tables).length, fkCount },
    };
    return graph;
}
