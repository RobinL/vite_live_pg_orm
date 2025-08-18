export type TableName = string;
export type ColumnName = string;

export interface ForeignKey {
    fromTable: TableName;
    fromCols: ColumnName[];   // sorted
    toTable: TableName;
    toCols: ColumnName[];     // sorted
    constraintName?: string;
}

export interface Table {
    name: TableName;          // normalized key, e.g. "customers" (no schema)
    qualifiedName?: string;   // e.g. "public.customers" (as-appeared)
    columns: ColumnName[];    // sorted
    primaryKey: ColumnName[]; // sorted
    fks: ForeignKey[];        // sorted
}

export interface SchemaGraph {
    tables: Record<TableName, Table>;
    stats?: { tableCount: number; fkCount: number };
}

export interface Selection { table: TableName; column: ColumnName | '*'; }

export interface JoinStep { from: TableName; to: TableName; fk: ForeignKey; }

export interface Plan {
    base: TableName;
    steps: JoinStep[];                   // ordered
    tableAlias: Record<TableName, string>;
    select: Array<{ table: TableName; column: ColumnName | '*' }>;
    warnings: string[];
}
