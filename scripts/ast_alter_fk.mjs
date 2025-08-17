import { parse } from 'pgsql-ast-parser';

const ddl = `ALTER TABLE ONLY public.orders
    ADD CONSTRAINT fk_orders_customers FOREIGN KEY (customer_id) REFERENCES public.customers(customer_id);`;

const ast = parse(ddl);
console.log(JSON.stringify(ast, null, 2));
