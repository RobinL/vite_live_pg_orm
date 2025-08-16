Here’s a crisp high-level spec for your app.

1) Product summary

A static (Vite, TS) browser app that lets a user paste Postgres DDL, type object-graph paths like orders.customer.name, orders.*, and see live generated SQL (SELECT + LEFT JOINs). Core value: schema-aware autocomplete that guides users through FK relationships to author joins fast.

2) Scope (MVP)

In
	•	Input: pasted Postgres DDL (CREATE TABLE … with PK/FK constraints).
	•	Output: readable Postgres SQL using SELECT and LEFT JOIN only.
	•	Autocomplete across the object graph (tables → relations → columns).
	•	Everything runs client-side; deployable as static files.
	•	Copy/share: copy SQL; permalink via URL hash (encodes DDL + query).

Out (for now)
	•	Executing SQL, writes/DDL changes, multiple dialects, cross-DB introspection.
	•	Composite FKs, advanced joins (RIGHT/FULL/CROSS), window functions, filters.

3) Users & jobs
	•	Devs/analysts who know their schema and want faster join authoring.
	•	Teach/learn: see SQL emitted live as you traverse relations.

4) Core UX
	•	Left pane: DDL editor (paste/import).
	•	Middle pane: object-graph query editor (DSL).
	•	Right pane: live SQL (formatted, copy button).
	•	Autocomplete:
	•	After orders. → suggest FK aliases (customer, billing_customer, …) and columns.
	•	After orders.customer. → suggest customers columns (e.g., name, email).
	•	Disambiguation UI when multiple FKs match a token (chooser dropdown).

5) Data model & semantics
	•	Build a schema graph: Table { columns, pk, fks[] }
	•	FK: { fromTable, fromCol, toTable, toCol, alias }
	•	Default alias: fromCol with _id stripped; fallback: toTable.
	•	DSL (minimal):
	•	Expression list: expr (, expr)*
	•	expr = base ( "." hop )* ( "." (column | "*") )?
	•	All expressions share the same base in MVP.
	•	Join plan rules:
	•	For each base → hop1 → hop2 … build a LEFT JOIN chain.
	•	Deduplicate joins by (fromTable → alias).
	•	ON condition: "alias"."toCol" = "fromTable"."fromCol".
	•	Deterministic table/alias names; safe quoting only when needed.

6) Error handling
	•	Unknown base/table/column → inline error with pointer.
	•	Ambiguous hop (multiple FKs) → prompt to choose; remember choice.
	•	Missing PK/FK info → explain limitation; suggest editing DDL.

7) Performance & footprint
	•	Target: load < 400 KB gzipped (no WASM).
	•	Handle schemas up to ~300 tables / 3–5k columns interactively.
	•	Parse DDL once; incremental rebuild on edits; debounce UI events.

8) Accessibility & polish
	•	Keyboard-first autocomplete; ARIA roles for lists.
	•	Monospace fonts, light/dark theme toggle.
	•	SQL formatting with consistent casing and indentation.

9) Tech & libraries (piggy-back, browser-safe)
	•	Vite + React + TypeScript.
	•	Editor: Monaco or CodeMirror 6 (completion API).
	•	DDL parser: pgsql-ast-parser (pure TS) to extract tables/PK/FKs.
	•	SQL formatter: sql-formatter (browser build).
	•	State: Zustand or Redux Toolkit (tiny slice).
	•	URL state: lz-string to compress DDL/DSL into the URL hash.

10) Architecture (modules)
	•	parser/ddl.ts → DDL → AST → SchemaGraph.
	•	dsl/parse.ts → DSL tokens → path segments.
	•	planner/joins.ts → segments → join plan (dedupe, aliases).
	•	emit/sql.ts → plan → SQL string → sql-formatter.
	•	ui/* → editors, preview, errors, copy/permalink.

11) Acceptance criteria (MVP)
	•	Paste canonical DDL (with FKs) → graph is built; no page reload.
	•	Typing orders.customer.name, orders.* yields correct LEFT JOIN SQL.
	•	Autocomplete suggests valid next tokens at each dot.
	•	Ambiguity prompt appears when orders.customer could mean multiple FKs.
	•	Copy SQL works; sharing URL reproduces state.

12) Security & privacy
	•	All processing in-browser; no network calls.
	•	DDL and queries only in memory / URL hash; optional localStorage save.

