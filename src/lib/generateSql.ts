import { format } from 'sql-formatter';
import type { SchemaGraph } from '../store';

export function generateSql(schema: SchemaGraph | null, base: string | null, sels: string[]): string {
    if (!schema || !base) return '-- select columns to start';
    return format('SELECT /* TODO implement */', { language: 'postgresql', keywordCase: 'upper' });
}
