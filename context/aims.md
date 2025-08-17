Here’s a compact, “hand-off ready” **Goals + Spec + Architecture** you can drop in front of an LLM (or a teammate) so it knows exactly what to build.

---

# 1) Product goals

## Primary objective

Build a **static, client-side web app** where a user pastes PostgreSQL DDL, **checks tables/columns** from a collapsible schema tree, and the app **emits a valid PostgreSQL `SELECT … LEFT JOIN …` query** that connects the chosen tables using detected foreign keys.

## Why this matters

* Fast way to author join queries without writing SQL.
* Transparent output (readable SQL, no magic execution).
* Runs entirely in the browser (safe for sensitive schemas).

## Success criteria (MVP)

* Paste DDL → app shows **all tables (collapsed)** with their columns.
* User can tick `table.*` or individual columns.
* App **infers/asks for a base table** and **generates a single `SELECT`** with:

  * Deterministic **aliases**,
  * **LEFT JOIN** edges for all needed paths,
  * Correct **`ON` conditions** (including composite FKs),
  * **Quoted identifiers** where needed,
  * Nicely **formatted** SQL.
* Warnings for unreachable tables (no FK path).
* Copy-to-clipboard works.
* App is shippable as **static files**.

## Explicit non-goals (MVP)

* Executing SQL; connecting to a database.
* Non-Postgres dialects.
* Filters/grouping/order/window functions.
* Row-level security / auth.
* Full keystroke-autocomplete (we’re using a schema checklist UI).

---

# 2) Constraints

* **100% client-side** (Vite build, static hosting).
* **TypeScript + React**; small, reliable dependencies only.
* Must handle **moderate schemas** (≈ up to 300 tables / a few thousand columns) interactively.
* Output **only `SELECT` + `LEFT JOIN`** (no other join types).
* Robust to odd identifiers (case, reserved words) by quoting.

---

# 3) Core UX

* **Left pane**: DDL input (textarea / drag-and-drop).
* **Middle pane**: **Schema tree (“checklist”)**

  * Each table is a `<details><summary>` **collapsed by default**.
  * Table summary includes a checkbox for **`table.*`**.
  * Expanding shows **column checkboxes**.
  * Optional search box to filter tables/columns.
* **Right pane**: Live **SQL output** (`<pre>`), copy button, and **warnings list**.
* **Base table**:

  * Defaults to the first table selected.
  * Editable via a dropdown near the SQL header (recomputes joins).

Behavioral rules:

* Checking `table.*` **unchecks** any of that table’s column selections, and vice-versa.
* Ticking columns in multiple tables is allowed; app computes the required join tree.
* If multiple shortest FK routes exist to the same table, app prompts for a **route choice** (simple modal) and remembers it.

---

# 4) Data model (TypeScript)

```ts
export type Ident = string;

export interface ForeignKey {
  fromTable: Ident;
  fromCols: Ident[];  // columns on fromTable
  toTable: Ident;
  toCols: Ident[];    // referenced columns on toTable
  name?: string;      // optional constraint name
}

export interface Table {
  name: Ident;                // optionally schema-qualified
  columns: Ident[];
  primaryKey: Ident[];        // 0..n
  fks: ForeignKey[];          // outgoing FKs
}

export interface SchemaGraph {
  tables: Record<Ident, Table>;
}

export type Selection =
  | { kind: 'star'; table: Ident }                 // table.*
  | { kind: 'column'; table: Ident; column: Ident };

export interface RouteChoiceIndex {
  // Keyed by "fromTable->toTable" or more precise signatures if needed
  [routeKey: string]: 'use:fknNameOrSignature';
}

export interface AppState {
  ddl: string;
  schema: SchemaGraph | null;
  base: Ident | null;
  selections: Selection[];         // built from checkboxes
  routeChoices: RouteChoiceIndex;  // user disambiguations
  warnings: string[];              // computed on each change
}
```

---

# 5) Algorithms

## 5.1 DDL → Schema graph

* Use a browser-safe parser to read `CREATE TABLE` statements.
* For each table collect:

  * `columns`: names
  * `primaryKey`: column list (column-level or table-level)
  * `fks`: for each `FOREIGN KEY`, capture `(fromCols[], toTable, toCols[])`
* Store in `SchemaGraph`. Ignore non-DDL statements.

## 5.2 Selection → involved tables

From `selections`, compute the set of **involved tables** `I`:

```
I = { base } ∪ { sel.table for each selection }
```

## 5.3 Join planning (BFS)

For each `t ∈ I \ {base}`:

1. **BFS** from `base` over FK edges (both directions):

   * Outgoing edges: `A --fk--> B`
   * Reverse edges: any table `X` with FK to `A` can be traversed `X <--fk-- A`
2. If multiple **shortest** paths exist:

   * Lookup `routeChoices["base->t"]`; if set, follow it.
   * Else prompt the user to pick one; cache the choice.
3. If no path: add warning “No FK path from base → t” and skip this table’s selections.

**Union** all edges from all paths → your **join edge set** (dedupe by `(from,to,fromCols,toCols)`).

## 5.4 Order & aliasing

* Compute a topological (layered) order expanding **outward from base** so a table is joined only after its parent is reachable.
* **Alias assignment**:

  * `t0` = base,
  * `t1..tn` = in discovered join order.
* If the same destination table is needed **twice via different relationships**, treat them as **two join instances** (different aliases). Key join instances by **parentAlias + FK signature**.

## 5.5 SQL emission

* SELECT list:

  * For `table.*` → emit `<alias>.*`
  * For specific columns → emit `<alias>.<"col">` (quoted if necessary)
  * If user selected nothing (edge case), default to `<baseAlias>.*`
* FROM:

  * `FROM <"base"> AS t0`
* JOINs:

  * For each join instance in order:

    * `LEFT JOIN <"table"> AS tK ON`
      `tParent."fromCol1" = tK."toCol1"` **AND** … (for composite FKs)

## 5.6 Quoting

* Quote identifiers that aren’t `/^[a-z_][a-z0-9_]*$/`.
* Escape `"` as `""` inside quotes.

## 5.7 Formatting

* Use a formatter with `{ language: 'postgresql', keywordCase: 'upper' }`.

---

# 6) Architecture

## 6.1 Overview

```
[ DDL Textarea ]
        │ onChange (debounced)
        ▼
  parseDDL(ddl) ───────────────► SchemaGraph
        │                             │
        └──────── set in store ◄──────┘
                                      │
                     [ Schema Tree (checkboxes) ]
                         │ updates selections, base
                         ▼
             computeJoinPlan(schema, base, selections, routeChoices)
                         │ → { sql, warnings }
                         ▼
              [ SQL Output pane ]  [ Warnings list ]
```

## 6.2 Modules

* `src/lib/parseDDL.ts`

  * `parseDDL(ddl: string): SchemaGraph`
  * Handles inline/table-level FKs and PKs; tolerant to extra statements.
* `src/lib/joinPlanner.ts`

  * `shortestPathBFS(schema, from, to, routeChoices): Edge[] | null`
  * `unionEdges(paths: Edge[][]): Edge[]`
  * `orderEdgesFromBase(edges: Edge[], base: Ident): { order: Ident[]; instances: JoinInstance[] }`
  * `assignAliases(instances, base): Map<JoinInstanceKey, Alias>`
  * `buildOnClause(instance, aliases): string`
* `src/lib/generateSql.ts`

  * `generateSql(schema, base, selections, routeChoices): { sql: string; warnings: string[] }`
* `src/components/DDLInput.tsx`

  * Controlled textarea; debounced parse (`300ms`).
* `src/components/SchemaTree.tsx`

  * Renders `<details><summary>` per table; checkboxes for `table.*` and columns.
  * Enforces mutual exclusivity (star vs columns).
  * Emits selection changes & sets base if not set.
  * Optional search filter.
* `src/components/BasePicker.tsx`

  * Dropdown of tables to set `base` explicitly.
* `src/components/RoutePicker.tsx`

  * Lightweight modal/popover used when equal-length routes exist; persists choice in `routeChoices`.
* `src/components/SQLOutput.tsx`

  * Shows warnings, pretty SQL, copy button.
* `src/store.ts` (Zustand)

  * Holds `ddl`, `schema`, `base`, `selections`, `routeChoices`, `warnings`.

## 6.3 State transitions

* **Paste DDL** → `ddl` updates → `parseDDL` → `schema` updates.
* **Tick/untick** → `selections` updates; if `base` null, set to selected table.
* **Change base** → recompute plan.
* **Disambiguate route** → update `routeChoices` and recompute.

## 6.4 Performance notes

* Debounce DDL parsing (300–500 ms).
* Precompute `incomingFksByTable` for faster reverse traversal.
* Memoize BFS per `(from,to,routeChoicesKey)`; invalidate on base change or DDL change.
* For very large schemas, consider parsing in a Web Worker (optional).

---

# 7) Acceptance tests (manual)

1. **Render graph**
   Paste:

   ```sql
   CREATE TABLE customers (id INT PRIMARY KEY, name TEXT, email TEXT);
   CREATE TABLE orders (id INT PRIMARY KEY, total NUMERIC, customer_id INT REFERENCES customers(id));
   ```

   * Schema pane shows `customers` and `orders` collapsed; expanding shows columns.

2. **Base inference & star**

   * Tick `orders.*` → base becomes `orders`; SQL shows:

     ```
     SELECT t0.*
     FROM "orders" AS t0;
     ```

3. **Single join**

   * Tick `customers.name` and `customers.email` → SQL shows one `LEFT JOIN "customers"` with `ON t0."customer_id" = t1."id"` and both columns in `SELECT`.

4. **Reverse edge traversal**

   * Untick customers; tick `customers.*` first (base is still `orders`); SQL still finds the join path and emits `LEFT JOIN customers`.

5. **Composite FK** (test case)

   * With a table `line_items(order_id, product_id)` referencing `(orders.id, products.id)`, tick columns from `products` → SQL emits **AND** conditions in `ON`.

6. **Unreachable**

   * Add a table `islands(id)` with no FKs; tick `islands.*` → a warning “No FK path from orders to islands”; SQL omits islands.

7. **Ambiguity**

   * If `orders` has `billing_customer_id` and `shipping_customer_id` both referencing `customers(id)`, ticking any `customers` column triggers **route picker**; picking “billing” emits the corresponding join. Adding “shipping” again creates a second join with a different alias.

---

# 8) Risks & mitigations

* **Ambiguous routes** → Use `RoutePicker` and **alias per join instance**.
* **Odd identifiers** → Always quote when needed (`"Name With Space"`).
* **Large DDL** → Debounce parsing; optional worker.
* **Bundle size creep** → Keep deps minimal (`pgsql-ast-parser`, `sql-formatter`, `zustand`, Tailwind).

---

# 9) Future extensions (nice-to-have)

* **Cascader path builder** (relations stepper) for more guided selection.
* **Per-table alias naming** UI.
* **URL hash persistence** (serialize DDL + selections + base).
* **Export** saved schemas to JSON (skip parsing next time).
* **Read-only SQL highlight** (CodeMirror read-only view).

---

# 10) Deliverables

* `dist/` static build.
* Source with:

  * `lib/parseDDL.ts`, `lib/joinPlanner.ts`, `lib/generateSql.ts`
  * Components listed above
  * Minimal tests for parser edge cases and planner (composite FK, ambiguity).

This document is designed to be directly consumable by an LLM or engineer: it nails down scope, contracts, algorithms, module boundaries, and verifiable outcomes so implementation can proceed in small, testable slices.
