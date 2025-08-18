CREATE TABLE person ( id integer PRIMARY KEY, crn text );
CREATE TABLE pseudonym ( id integer PRIMARY KEY, fk_person_id integer NOT NULL, last_name text );

ALTER TABLE ONLY pseudonym
  ADD CONSTRAINT fk_person_alias_id
  FOREIGN KEY (fk_person_id)
  REFERENCES person(id);
