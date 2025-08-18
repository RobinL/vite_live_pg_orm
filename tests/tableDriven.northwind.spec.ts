import { describe, it, expect } from 'vitest';
import { build } from './helpers/build';

const cases = [
    {
        name: 'customers->orders',
        base: 'customers',
        selects: ['orders.order_id'],
        path: ['customers->orders'],
    },
    {
        name: 'orders->order_details',
        base: 'orders',
        selects: ['order_details.quantity'],
        path: ['orders->order_details'],
    },
] as const;

describe.each(cases)('$name', ({ base, selects, path }) => {
    const { plan } = build('northwind_schema.sql', base, selects);
    it('path', () => expect(plan).toHaveJoinPath(path));
});
