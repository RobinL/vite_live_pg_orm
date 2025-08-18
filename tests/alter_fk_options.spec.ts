import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildGraphFromDDL } from '../src/lib/buildGraph';
import { planJoins } from '../src/lib/plan';
import { emitSQL } from '../src/lib/sql';

describe('ALTER TABLE with FK (no regex)', () => {
    const ddl = readFileSync(resolve(__dirname, 'fixtures/alter_fk_options.sql'), 'utf8');
    const g = buildGraphFromDDL(ddl);

    it('captures FK added via ALTER TABLE', () => {
        const p = planJoins(g, 'pseudonym', ['pseudonym.last_name', 'person.crn']);
        expect(p).toBeTruthy();
        expect(p!.steps.map(s => `${s.from}->${s.to}`)).toEqual(['pseudonym->person']);
        const sql = emitSQL(p!);
        expect(sql.toLowerCase()).toContain('left join person as');
    });
});
