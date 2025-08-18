import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildGraphFromDDL } from '../src/lib/buildGraph';

const ddl = readFileSync(resolve(__dirname, 'fixtures/mini.sql'), 'utf8');
const g = buildGraphFromDDL(ddl);

describe('buildGraphFromDDL (mini)', () => {
    it('collects tables & columns', () => {
        expect(Object.keys(g.tables).sort()).toEqual(['customers', 'orders']);
        expect(g.tables.customers.columns).toContain('company_name');
        expect(g.tables.orders.columns).toContain('employee_id');
    });

    it('captures PK & FK', () => {
        expect(g.tables.customers.primaryKey).toEqual(['customer_id']);
        const fks = g.tables.orders.fks;
        expect(fks).toEqual([
            expect.objectContaining({ fromTable: 'orders', fromCols: ['customer_id'], toTable: 'customers', toCols: ['customer_id'] })
        ]);
    });

    it('normalizes keys (no public.)', () => {
        expect(g.tables['public.customers']).toBeUndefined();
        expect(g.tables.customers).toBeDefined();
    });
});
