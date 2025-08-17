import { parse } from 'pgsql-ast-parser';

const ddl = `CREATE TABLE customers (id INT PRIMARY KEY, name TEXT, email TEXT);
CREATE TABLE orders (
  id INT PRIMARY KEY,
  total NUMERIC,
  customer_id INT REFERENCES customers(id)
);`;

const ast = parse(ddl);
console.log(JSON.stringify(ast, null, 2));
