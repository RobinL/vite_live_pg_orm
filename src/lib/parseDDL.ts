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
    // tiny helpers to safely read nested properties without `any`
    const get = (obj: unknown, key: string): unknown => (obj && typeof obj === 'object') ? (obj as Record<string, unknown>)[key] : undefined;
    const getNameStr = (obj: unknown): string | undefined => {
        const n = get(obj, 'name');
        return typeof n === 'string' ? n : undefined;
    };
    const getTypeStr = (obj: unknown): string | undefined => {
        const t = get(obj, 'type');
        return typeof t === 'string' ? t : undefined;
    };

    for (const stmtU of ast as unknown[]) {
        const stmt = stmtU as Record<string, unknown>;
        if (getTypeStr(stmt) === 'create table') {
            const name: string | undefined = getNameStr(get(stmt, 'name'));
            if (!name) continue;

            const columns: string[] = [];
            const primaryKey: string[] = [];
            const fks: ForeignKey[] = [];

            // Column defs (+ inline constraints)
            const stmtCols = get(stmt, 'columns');
            const colsArr: unknown[] = Array.isArray(stmtCols) ? stmtCols : [];
            for (const colU of colsArr) {
                const col = colU as Record<string, unknown>;
                const colName: string | undefined = getNameStr(get(col, 'name'));
                if (colName) columns.push(colName);

                const constraintsU = get(col, 'constraints');
                const constraints: unknown[] = Array.isArray(constraintsU) ? constraintsU : [];
                for (const cU of constraints) {
                    const c = cU as Record<string, unknown>;
                    const ctype = getTypeStr(c);
                    if (ctype === 'references') {
                        const toTable = getNameStr(get(c, 'table')) ?? '';
                        const ccolsU = get(c, 'columns');
                        const ccols: unknown[] = Array.isArray(ccolsU) ? ccolsU : [];
                        const toCols = ccols
                            .map((x) => getNameStr(x))
                            .filter((v): v is string => typeof v === 'string');
                        fks.push({
                            fromCols: colName ? [colName] : [],
                            toTable,
                            toCols,
                        });
                    }
                    if (ctype === 'primary key' && colName) {
                        primaryKey.push(colName);
                    }
                }
            }

            // Table-level constraints
            const tblConstraintsU = get(stmt, 'constraints');
            const tblConstraints: unknown[] = Array.isArray(tblConstraintsU) ? tblConstraintsU : [];
            for (const cU of tblConstraints) {
                const c = cU as Record<string, unknown>;
                const ctype = getTypeStr(c);
                if (ctype === 'primary key') {
                    const colsU = get(c, 'columns');
                    const cols: unknown[] = Array.isArray(colsU) ? colsU : [];
                    const names = cols
                        .map((x) => getNameStr(x))
                        .filter((v): v is string => typeof v === 'string');
                    primaryKey.splice(0, primaryKey.length, ...names);
                }
                if (ctype === 'foreign key') {
                    const fromColsU = get(c, 'columns');
                    const fromColsArr: unknown[] = Array.isArray(fromColsU) ? fromColsU : [];
                    const fromCols = fromColsArr
                        .map((x) => getNameStr(x))
                        .filter((v): v is string => typeof v === 'string');

                    const refs = get(c, 'references');
                    const toTable = getNameStr(get(refs, 'table')) ?? '';
                    const toColsU = get(refs, 'columns');
                    const toColsArr: unknown[] = Array.isArray(toColsU) ? toColsU : [];
                    const toCols = toColsArr
                        .map((x) => getNameStr(x))
                        .filter((v): v is string => typeof v === 'string');

                    fks.push({ fromCols, toTable, toCols });
                }
            }

            tables[name] = { name, columns, fks, primaryKey };
        }
    }
    return { tables };
}
