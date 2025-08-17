import { parse } from 'pgsql-ast-parser';

export interface Table {
    name: string;
    columns: string[];
    fks: ForeignKey[];
    primaryKey: string[];
}
export interface ForeignKey {
    fromCols: string[];
    toTable: string;
    toCols: string[];
}

export function parseDDL(ddl: string) {
    const ast = parse(ddl);
    const tables: Record<string, Table> = {};
    // iterate ast, identify 'create table' nodes (see library docs) …
    // For now, just extract table names and columns
    for (const stmt of ast) {
        if (stmt.type === 'create table') {
            const name = stmt.name.name;
            const columns = stmt.columns
                ? stmt.columns
                    .filter(col => typeof col === 'object' && col !== null && 'name' in col && col.name && typeof (col as any).name.name === 'string')
                    .map(col => (col as any).name.name)
                : [];
            tables[name] = {
                name,
                columns,
                fks: [],
                primaryKey: [],
            };
        }
    }
    return { tables };
}
