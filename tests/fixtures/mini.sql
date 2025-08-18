CREATE TABLE public.customers (
  customer_id char(5) NOT NULL,
  company_name varchar(40) NOT NULL
);

CREATE TABLE public.orders (
  order_id smallint NOT NULL,
  customer_id char(5),
  employee_id smallint
);

ALTER TABLE ONLY public.customers
  ADD CONSTRAINT pk_customers PRIMARY KEY (customer_id);

ALTER TABLE ONLY public.orders
  ADD CONSTRAINT pk_orders PRIMARY KEY (order_id);

ALTER TABLE ONLY public.orders
  ADD CONSTRAINT fk_orders_customers FOREIGN KEY (customer_id)
  REFERENCES public.customers(customer_id);
