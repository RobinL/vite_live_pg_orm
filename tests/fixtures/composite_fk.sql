-- composite PK/FK: child(a_id,b_id) references parent(a_id,b_id)
CREATE TABLE parent (
  a_id integer,
  b_id integer,
  PRIMARY KEY (a_id, b_id)
);
CREATE TABLE child (
  a_id integer,
  b_id integer,
  qty integer,
  PRIMARY KEY (a_id, b_id)
);
ALTER TABLE ONLY child ADD CONSTRAINT child_parent_fk FOREIGN KEY (a_id, b_id) REFERENCES parent(a_id, b_id);
