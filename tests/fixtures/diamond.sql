-- diamond: A references B and C; D references both B and C; equal-cost paths from A to D via B or C
CREATE TABLE a (
  id integer PRIMARY KEY,
  b_id integer,
  c_id integer
);
CREATE TABLE b (
  id integer PRIMARY KEY
);
CREATE TABLE c (
  id integer PRIMARY KEY
);
CREATE TABLE d (
  id integer PRIMARY KEY,
  b_id integer,
  c_id integer
);
ALTER TABLE ONLY a ADD CONSTRAINT a_b_fk FOREIGN KEY (b_id) REFERENCES b(id);
ALTER TABLE ONLY a ADD CONSTRAINT a_c_fk FOREIGN KEY (c_id) REFERENCES c(id);
ALTER TABLE ONLY d ADD CONSTRAINT d_b_fk FOREIGN KEY (b_id) REFERENCES b(id);
ALTER TABLE ONLY d ADD CONSTRAINT d_c_fk FOREIGN KEY (c_id) REFERENCES c(id);
