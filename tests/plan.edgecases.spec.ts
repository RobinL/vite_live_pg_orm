import { describe, it, expect } from 'vitest';
import { buildGraphFromDDL } from '../src/lib/buildGraph';
import { planJoins } from '../src/lib/plan';
import { emitSQL } from '../src/lib/sql';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function fixture(name: string) {
    const p = resolve(__dirname, 'fixtures', name);
    return readFileSync(p, 'utf8');
}

describe('planner edge cases', () => {
    it('diamond: deterministic path and warning on equal-cost', () => {
        const ddl = fixture('diamond.sql');
        const g = buildGraphFromDDL(ddl);
        const p = planJoins(g, 'a', ['d.*']);
        expect(p).toBeTruthy();
        const plan = p!;
        // Should choose lexicographically by neighbor (b before c); assert exact path
        expect(plan).toHaveJoinPath(['a->b', 'b->d']);
        expect(plan.warnings.find(w => /Multiple equal-cost join paths/i.test(w))).toBeTruthy();
        const sql = emitSQL(plan);
        expect(sql).toMatch(/left join "?b"?/i);
    });

    it('self-fk: selecting only base does not create a self-join', () => {
        const ddl = fixture('self_fk.sql');
        const g = buildGraphFromDDL(ddl);
        const p = planJoins(g, 'employees', ['employees.*']);
        expect(p).toBeTruthy();
        expect(p!.steps.length).toBe(0);
    });

    it('composite: FK pairs include both columns (plan-level check, no SQL)', () => {
        const ddl = fixture('composite_fk.sql');
        const g = buildGraphFromDDL(ddl);
        const p = planJoins(g, 'child', ['child.*', 'parent.*']);
        expect(p).toBeTruthy();

        // find the child->parent step
        const step = p!.steps.find(s =>
            (s.from === 'child' && s.to === 'parent') ||
            (s.from === 'parent' && s.to === 'child')
        );
        expect(step).toBeTruthy();

        // Regardless of direction, the fk must pair both a_id and b_id
        const fromCols = step!.fk.fromCols.slice().sort();
        const toCols = step!.fk.toCols.slice().sort();
        expect(fromCols).toEqual(['a_id', 'b_id']);
        expect(toCols).toEqual(['a_id', 'b_id']);
    });
});
