Below is a **ground‑up implementation plan** for the *check‑the‑columns* version you settled on.
It is written as a sequence of **verifiable stages**; after finishing (and committing) each stage you can run the dev server, click around exactly as instructed in *Acceptance tests*, and prove the app still works before moving on.

> **Tip for LLM usage:** feed it *one stage at a time*. After a stage is “green”, ask for the next. That keeps context small and avoids partial copy/paste errors.

---

## Tech stack locked‑in

| Topic          | Decision                                     | Reason                                  |
| -------------- | -------------------------------------------- | --------------------------------------- |
| Build          | **Vite + React + TS**                        | Fast HMR, static output, first‑class TS |
| Styling        | **Tailwind CSS** (via PostCSS)               | Tiny, tree‑shakes, quick layout         |
| State          | **Zustand** (tiny, no boilerplate)           | Simpler than Redux; fine for this size  |
| Schema parser  | **pgsql‑ast‑parser** (pure TS)               | Browser‑safe, no WASM                   |
| SQL prettifier | **sql‑formatter** (`language: 'postgresql'`) | Readable output                         |
| Join planner   | Home‑grown BFS (≈100 LoC)                    | Exact control & small bundle            |

---

git commit -m "stage 0 scaffold"

## STAGE 0 — Repo hygiene (0.5 h)
- [x] Initialise repo & tools
- [x] TS config
- [x] ESLint + Prettier
- [x] Optional: husky pre‑commit hook
- [x] Acceptance: npm run lint, commit



## STAGE 1 — Vite + React boilerplate (1 h)
- [x] Scaffold Vite + React
- [x] Replace App.tsx with hello banner
- [x] Acceptance: Browser shows “Hello • Stage 1”, HMR works



## STAGE 2 — 3‑pane responsive layout (1 h)
- [x] Add Tailwind (v4, no CLI)
- [x] postcss.config.js
- [x] src/index.css
- [x] Import CSS in entry
- [x] Replace App.tsx with 3-pane layout
- [x] Acceptance: Responsive panes, <details> demo



## STAGE 3 — Global state (ddl, schema, selections) (1 h)
- [x] Zustand installed
- [x] store.ts created
- [x] Textarea wired to store
- [x] Schema pane shows DDL char count
- [x] Acceptance: typing updates count reactively

---


## STAGE 4 — Real DDL parse & tree render (2 h)
- [x] pgsql-ast-parser installed
- [x] parseDDL helper created
- [x] DDL parsing wired in App
- [x] SchemaTree component implemented
- [x] Schema pane replaced with tree UI
- [x] Acceptance: tables and columns appear, checkboxes toggle selections

---


## STAGE 5 — Selection rules & base‑table inference (1 h)

| Goal                                                                       | Outcome                    |
| -------------------------------------------------------------------------- | -------------------------- |
| Table‐star vs column checkboxes stay mutually exclusive; base table chosen | selection UI feels correct |

### Tasks

- [x] Mutual exclusivity in `toggleSelection`
- [x] Base table derivation
- [x] Show base under SQL pane header

### Acceptance

- [x] Select `orders.*` → base auto‑set to `orders`.
- [x] Selecting `customers.name` next does **not** change base.
- [x] Checking `orders.*` then checking `orders.id` unchecks the star and leaves the column ticked.

---


## STAGE 6 — Join‑planner stub & live SQL pipe (1 h)

| Goal                                                           | Outcome                            |
| -------------------------------------------------------------- | ---------------------------------- |
| Selections produce *some* SQL string (`-- TODO`), updates live | proves state → generator → UI loop |

### Tasks

- [x] `src/lib/generateSql.ts` stub
- [x] SQL pane uses generateSql
- [x] sql-formatter installed

### Acceptance

- [x] After selecting any column, SQL pane shows a formatted `SELECT /* TODO implement */`.

---

## STAGE 7 — Real BFS join planner (3 h)

| Goal                                                          | Outcome                 |
| ------------------------------------------------------------- | ----------------------- |
| Proper SELECT … LEFT JOIN SQL for any selected tables/columns | core algorithm finished |

### Tasks

- [x] Enrich schema graph (PK/FK) in `parseDDL`
- [x] Implement BFS pathing, union, ordering, aliases, ON clause
- [x] `generateSql` returns `{ sql, warnings }` and uses `sql-formatter`
- [x] Render warnings above SQL pane

### Acceptance

- [x] `orders.*` only → SELECT t0.* FROM orders AS t0;
- [x] `orders.*` + `customers.name, customers.email` → one LEFT JOIN with qualified columns
- [x] Unreachable table → shows warning and omits that table’s columns

---

## STAGE 8 — UI polish & collapsible `<details>` tweaks (1 h)

| Goal                                                 | Outcome       |
| ---------------------------------------------------- | ------------- |
| Nice defaults, big‑schema usability, copy SQL button | MVP shippable |

### Tasks

- [x] Collapse all tables by default (`<details open={false}>`).
- [x] Add search box to filter tables.
- [x] Add Copy button and sticky SQL header.
- [x] Textarea monospace and auto‑grow rows.

### Acceptance

- [x] With many tables, search narrows instantly.
- [x] Copy button copies exact SQL.
- [x] Tables collapsed on first render.

---

## STAGE 9 — Edge‑case hardening (optional, 2 h)

| Item                        | Fix                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| **Composite FK**            | ON clause loop already handles arrays → add unit test                                     |
| **Quoted identifiers**      | implement `quoteIdent` (wrap if not /^\[a-z\_]\[a-z0-9\_]\*\$/)                           |
| **Two roles to same table** | when BFS sees *two equal‑cost paths*, prompt user which to use (`window.confirm` MVP)     |
| **Large DDL freeze**        | debounce parse 300 ms; if ddl.length > 50k then parse in a WebWorker (vite-plugin‑worker) |
### Status

- [x] Quoted identifiers via `quoteIdent` in generator
- [x] Equal-cost BFS path detection with a warning (deterministic choice)
- [x] Composite FK handled (array pair loop)
- [x] Debounced parsing already implemented

This plan keeps each step **atomic and verifiable**; you’ll have a working application as early as Stage 4 and a feature‑complete MVP by Stage 8.
---

## Done 🎉 — Deliverables

* `/dist` folder (`npm run build`) — static site; drop on S3/GH Pages.
* `/src/lib/*` — clean, unit‑tested BFS planner & parser.
* README with copy/paste DDL example and screenshot.

This plan keeps each step **atomic and verifiable**; you’ll have a working application as early as Stage 4 and a feature‑complete MVP by Stage 8.
