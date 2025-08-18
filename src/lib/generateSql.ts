import type { SchemaGraph } from './types';
import { plan } from './plan';
import { emitSQL } from './sql';

export function generateSql(
    schema: SchemaGraph | null,
    base: string | null,
    sels: string[]
): { sql: string; warnings: string[] } {
    const p = plan(schema, base, sels);
    if (!p) return { sql: '-- select columns to start', warnings: [] };
    const sql = emitSQL(p);
    return { sql, warnings: p.warnings };
}
