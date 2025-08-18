import type { Plan } from './types';
import { quoteIdent } from './idents';

export function emitSQL(plan: Plan): string {
    const a = (t: string) => plan.tableAlias[t];
    const lines: string[] = [];

    // SELECT
    const selectParts = plan.select.map(s =>
        s.column === '*' ? `${a(s.table)}.*` : `${a(s.table)}.${quoteIdent(s.column)}`
    );
    lines.push('SELECT');
    lines.push('  ' + selectParts.join(',\n  '));

    // FROM
    lines.push('FROM');
    lines.push(`  ${quoteIdent(plan.base)} AS ${a(plan.base)}`);

    // JOINs
    for (const step of plan.steps) {
        const { fk } = step;
        const fromAlias = a(step.from);
        const toAlias = a(step.to);
        const forward = step.to === fk.toTable; // else reverse
        const onParts: string[] = [];
        const pairs = Math.min(fk.fromCols.length, fk.toCols.length);
        for (let i = 0; i < pairs; i++) {
            const lcol = forward ? fk.fromCols[i] : fk.toCols[i];
            const rcol = forward ? fk.toCols[i] : fk.fromCols[i];
            onParts.push(`${fromAlias}.${quoteIdent(lcol)} = ${toAlias}.${quoteIdent(rcol)}`);
        }
        const onClause = onParts.length ? onParts.join(' AND ') : '1=1';
        lines.push(`LEFT JOIN ${quoteIdent(step.to)} AS ${toAlias} ON ${onClause}`);
    }

    return lines.join('\n') + ';';
}

