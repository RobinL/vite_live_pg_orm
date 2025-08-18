-- self foreign key: employees reports_to employees
CREATE TABLE employees (
  employee_id integer PRIMARY KEY,
  name text,
  reports_to integer
);
ALTER TABLE ONLY employees ADD CONSTRAINT employees_reports_fk FOREIGN KEY (reports_to) REFERENCES employees(employee_id);
