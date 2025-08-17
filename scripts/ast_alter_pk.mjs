import { parse } from 'pgsql-ast-parser';

const ddl = `ALTER TABLE ONLY public.customers
    ADD CONSTRAINT pk_customers PRIMARY KEY (customer_id);`;

const ast = parse(ddl);
console.log(JSON.stringify(ast, null, 2));
