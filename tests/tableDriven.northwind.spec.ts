import { describe, it, expect } from 'vitest';
import { build } from './helpers/build';

const cases = [
    // existing
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

    // NEW multi-hop paths
    {
        name: 'customers->order_details (via orders)',
        base: 'customers',
        selects: ['order_details.quantity'],
        path: ['customers->orders', 'orders->order_details'],
    },
    {
        name: 'customers->products (via orders -> order_details)',
        base: 'customers',
        selects: ['products.product_name'],
        path: ['customers->orders', 'orders->order_details', 'order_details->products'],
    },
    {
        name: 'orders->categories (via order_details -> products)',
        base: 'orders',
        selects: ['categories.category_name'],
        path: ['orders->order_details', 'order_details->products', 'products->categories'],
    },
    {
        name: 'products->customers (via order_details -> orders)',
        base: 'products',
        selects: ['customers.company_name'],
        path: ['products->order_details', 'order_details->orders', 'orders->customers'],
    },
    {
        name: 'shippers->customers (via orders)',
        base: 'shippers',
        selects: ['customers.company_name'],
        path: ['shippers->orders', 'orders->customers'],
    },
    {
        name: 'employees->region (via employee_territories -> territories)',
        base: 'employees',
        selects: ['region.region_description'],
        path: [
            'employees->employee_territories',
            'employee_territories->territories',
            'territories->region',
        ],
    },
    {
        name: 'territories->employees (via employee_territories)',
        base: 'territories',
        selects: ['employees.last_name'],
        path: ['territories->employee_territories', 'employee_territories->employees'],
    },

    // Multiple direct neighbors from same base — order follows `selects`
    {
        name: 'orders -> customers, employees, shippers (deterministic by selects order)',
        base: 'orders',
        selects: [
            'customers.company_name',
            'employees.last_name',
            'shippers.company_name',
        ],
        path: ['orders->customers', 'orders->employees', 'orders->shippers'],
    },

    // Two different direct neighbors from a junction table
    {
        name: 'customer_customer_demo -> customers + customer_demographics',
        base: 'customer_customer_demo',
        selects: ['customers.company_name', 'customer_demographics.customer_desc'],
        path: [
            'customer_customer_demo->customers',
            'customer_customer_demo->customer_demographics',
        ],
    },
] as const;

describe.each(cases)('$name', ({ base, selects, path }) => {
    const { plan } = build('northwind_schema.sql', base, selects);
    it('path', () => expect(plan).toHaveJoinPath(path));
});

// Unreachable target: us_states is isolated in Northwind
describe('unreachable targets', () => {
    it('warns and adds no joins for customers -> us_states', () => {
        const { plan } = build('northwind_schema.sql', 'customers', ['us_states.state_name']);
        expect(plan.steps.length).toBe(0);
        expect(
            plan.warnings.some((w) =>
                /No FK path from customers to us_states; omitting its columns\./i.test(w),
            ),
        ).toBe(true);
    });
});
