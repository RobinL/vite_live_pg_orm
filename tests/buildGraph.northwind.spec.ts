import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildGraphFromDDL } from '../src/lib/buildGraph';

const ddl = readFileSync(resolve(__dirname, 'fixtures/northwind_schema.sql'), 'utf8');
const g = buildGraphFromDDL(ddl);

describe('buildGraphFromDDL (Northwind)', () => {
    it('has all 14 tables', () => {
        expect(Object.keys(g.tables).length).toBe(14);
    });

    it('orders has FKs to customers, employees, shippers', () => {
        const want = [
            ['customer_id', 'customers', 'customer_id'],
            ['employee_id', 'employees', 'employee_id'],
            ['ship_via', 'shippers', 'shipper_id'],
        ];
        for (const [fromCol, toTable, toCol] of want) {
            expect(g.tables.orders.fks.some(f =>
                f.fromCols.length === 1 && f.fromCols[0] === fromCol &&
                f.toTable === toTable && f.toCols.length === 1 && f.toCols[0] === toCol
            )).toBe(true);
        }
    });

    it('order_details has composite PK and two FKs', () => {
        expect(g.tables.order_details.primaryKey).toEqual(['order_id', 'product_id']);
        const fks = g.tables.order_details.fks;
        expect(fks.some(f => f.toTable === 'orders' && f.fromCols[0] === 'order_id' && f.toCols[0] === 'order_id')).toBe(true);
        expect(fks.some(f => f.toTable === 'products' && f.fromCols[0] === 'product_id' && f.toCols[0] === 'product_id')).toBe(true);
    });

    it('employees has self-FK reports_to → employees(employee_id)', () => {
        expect(g.tables.employees.fks.some(f =>
            f.toTable === 'employees' &&
            f.fromCols.length === 1 && f.fromCols[0] === 'reports_to' &&
            f.toCols.length === 1 && f.toCols[0] === 'employee_id'
        )).toBe(true);
    });
});
