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

| Goal                                                              | Outcome                |
| ----------------------------------------------------------------- | ---------------------- |
| typing DDL stores in Zustand; schema placeholder shows char count | proves reactive wiring |

### Tasks

1. `npm install zustand`
2. `src/store.ts`

   ```ts
   import { create } from 'zustand';

   export interface SchemaGraph { tables: Record<string, unknown> } // temp

   export const useStore = create<{
     ddl: string;
     setDDL: (s: string) => void;
     schema: SchemaGraph | null;
     setSchema: (g: SchemaGraph | null) => void;
     selections: string[];                // 'table.*' or 'table.column'
     toggleSelection: (id: string) => void;
   }>((set, get) => ({
     ddl: '',
     setDDL: (ddl) => set({ ddl }),
     schema: null,
     setSchema: (schema) => set({ schema }),
     selections: [],
     toggleSelection: (id) =>
       set((s) =>
         s.selections.includes(id)
           ? { selections: s.selections.filter((x) => x !== id) }
           : { selections: [...s.selections, id] }
       ),
   }));
   ```
3. Wire textarea:

   ```tsx
   const { ddl, setDDL } = useStore();
   <textarea value={ddl} onChange={(e) => setDDL(e.target.value)} … />
   ```
4. In Schema pane:

   ```tsx
   const ddlLen = useStore((s) => s.ddl.length);
   <p>{ddlLen ? `${ddlLen} chars in DDL` : 'No schema yet.'}</p>
   ```

### Acceptance

* Type “abc” → Schema pane shows “3 chars in DDL”.

---

## STAGE 4 — Real DDL parse & tree render (2 h)

| Goal                                                              | Outcome                   |
| ----------------------------------------------------------------- | ------------------------- |
| Pasting sample DDL shows collapsible tables & columns (unchecked) | verifies parser + tree UI |

### Tasks

1. `npm install pgsql-ast-parser`
2. **Parser helper** `src/lib/parseDDL.ts`

   ```ts
   import { parse } from 'pgsql-ast-parser';
   export interface Table { name: string; columns: string[]; fks: ForeignKey[]; primaryKey: string[] }
   export interface ForeignKey { fromCols: string[]; toTable: string; toCols: string[] }

   export function parseDDL(ddl: string) {
     const ast = parse(ddl);
     const tables: Record<string, Table> = {};
     // iterate ast, identify 'create table' nodes (see library docs) …
     return { tables };
   }
   ```

   (You only need table names & column names for this stage — skip FKs for now.)
3. In `App.tsx` add:

   ```tsx
   const ddl = useStore((s) => s.ddl);
   const setSchema = useStore((s) => s.setSchema);
   useEffect(() => {
     try {
       const g = ddl.trim() ? parseDDL(ddl) : null;
       setSchema(g);
     } catch (e) {
       setSchema(null);
       console.error(e);
     }
   }, [ddl]);
   ```
4. **SchemaTree component** `SchemaTree.tsx`

   ```tsx
   const { schema, selections, toggleSelection } = useStore();
   if (!schema) return <p className="text-gray-500">No schema.</p>;

   return (
     <ul className="space-y-1">
       {Object.values(schema.tables).map((t) => (
         <li key={t.name}>
           <details>
             <summary className="cursor-pointer">
               <input
                 type="checkbox"
                 className="mr-1"
                 checked={selections.includes(`${t.name}.*`)}
                 onChange={() => toggleSelection(`${t.name}.*`)}
               />
               {t.name}
             </summary>
             <ul className="ml-4">
               {t.columns.map((c) => (
                 <li key={c}>
                   <label className="inline-flex items-center space-x-1">
                     <input
                       type="checkbox"
                       checked={selections.includes(`${t.name}.${c}`)}
                       onChange={() => toggleSelection(`${t.name}.${c}`)}
                     />
                     <span>{c}</span>
                   </label>
                 </li>
               ))}
             </ul>
           </details>
         </li>
       ))}
     </ul>
   );
   ```
5. Replace placeholder in Schema pane with `<SchemaTree />`.
6. **Test DDL** (paste in browser):

   ```sql
   CREATE TABLE customers (id INT PRIMARY KEY, name TEXT, email TEXT);
   CREATE TABLE orders (
     id INT PRIMARY KEY,
     total NUMERIC,
     customer_id INT REFERENCES customers(id)
   );
   ```

### Acceptance

* Tables `customers` & `orders` appear collapsed.
* Expanding shows column checkboxes.
* Checking/unchecking toggles `useStore.getState().selections`.

---

## STAGE 5 — Selection rules & base‑table inference (1 h)

| Goal                                                                       | Outcome                    |
| -------------------------------------------------------------------------- | -------------------------- |
| Table‐star vs column checkboxes stay mutually exclusive; base table chosen | selection UI feels correct |

### Tasks

1. **Mutual exclusivity** in `toggleSelection`:

   ```ts
   if (id.endsWith('.*')) {
     // remove any `${table}.col` selections
   } else {
     // if selecting a column, remove `${table}.*` if present
   }
   ```
2. **Base table derivation**
   Extend store:

   ```ts
   base: null as string | null,
   setBase: (tbl: string) => set({ base: tbl }),
   ```

   In `toggleSelection`, if `base` is null **and** id belongs to some table, set it.
3. Show base under SQL pane header:

   ```tsx
   const base = useStore((s) => s.base);
   <header>SQL {base && <span className="text-sm text-gray-500">(base: {base})</span>}</header>
   ```

### Acceptance

* Select `orders.*` → base auto‑set to `orders`.
* Selecting `customers.name` next does **not** change base.
* Checking `orders.*` then checking `orders.id` unchecks the star and leaves the column ticked.

---

## STAGE 6 — Join‑planner stub & live SQL pipe (1 h)

| Goal                                                           | Outcome                            |
| -------------------------------------------------------------- | ---------------------------------- |
| Selections produce *some* SQL string (`-- TODO`), updates live | proves state → generator → UI loop |

### Tasks

1. `src/lib/generateSql.ts`

   ```ts
   import { format } from 'sql-formatter';
   import { SchemaGraph } from '../store';

   export function generateSql(schema: SchemaGraph | null, base: string | null, sels: string[]) {
     if (!schema || !base) return '-- select columns to start';
     return format('SELECT /* TODO implement */', { language: 'postgresql', keywordCase: 'upper' });
   }
   ```
2. In SQL pane’s `<pre>`:

   ```tsx
   const { schema, base, selections } = useStore();
   const sql = generateSql(schema, base, selections);
   <pre …>{sql}</pre>
   ```

### Acceptance

* After selecting any column, SQL pane shows a formatted `SELECT /* TODO implement */`.

---

## STAGE 7 — Real BFS join planner (3 h)

| Goal                                                          | Outcome                 |
| ------------------------------------------------------------- | ----------------------- |
| Proper SELECT … LEFT JOIN SQL for any selected tables/columns | core algorithm finished |

### Tasks

> **Everything here is pure TypeScript; unit‑test in Vitest** (`npm install -D vitest @testing-library/react`).

1. **Enrich schema graph** in `parseDDL`: collect

   * `table.columns: string[]`
   * `table.primaryKey`
   * `table.fks: { fromCols: string[]; toTable; toCols: string[] }[]`
2. **Planner helpers**
   *`joinPlanner.ts`* (use code from “simple join builder” earlier):

   * `shortestPathBFS`
   * `unionEdges`
   * `orderEdgesFromBase`
   * `assignAliases`
   * `buildOnClause`
   * `generateSql(...)` puts it together:

     1. Determine tables involved from selections.
     2. BFS per table; warn if unreachable.
     3. Union edges, alias, build SELECT list:

        * if `table.*` selected, push `${alias}.*`
        * else push `${alias}."col"` for each column.
     4. Build `FROM` + `LEFT JOIN`s.
     5. `sql-formatter` the result and append `;`.
3. **SQL pane** now shows real query.
4. **Warnings** — return `{ sql, warnings }`; render warnings list above `<pre>`.

### Acceptance

1. With test DDL: select `orders.*` only

   ```sql
   SELECT
     t0.*
   FROM
     orders AS t0;
   ```
2. Select `orders.*` **and** `customers.name, customers.email`
   Query shows one LEFT JOIN to customers with two qualified columns.
3. Select a table that has no FK path → warnings show “No FK path …”; SQL omits that table’s columns.

---

## STAGE 8 — UI polish & collapsible `<details>` tweaks (1 h)

| Goal                                                 | Outcome       |
| ---------------------------------------------------- | ------------- |
| Nice defaults, big‑schema usability, copy SQL button | MVP shippable |

### Tasks

1. Collapse all tables by default (`<details open={false}>`).
2. Add **search box** above tree: filters tables by substring (simple `.filter()`).
3. Add **Copy** button:

   ```tsx
   navigator.clipboard.writeText(sql)
   ```
4. Tailwind classes: `summary:hover:bg-slate-100`, sticky SQL header on long output.
5. Format textarea monospace (`font-mono`) and auto‑grow rows (`rows={ddl.split('\n').length+2}`).
6. Resize panes via CSS `resize` on middle pane if you like.

### Acceptance

* With >10 tables, search narrows instantly.
* Copy button copies exact SQL (paste in Notepad).
* Tables collapsed on first render.

---

## STAGE 9 — Edge‑case hardening (optional, 2 h)

| Item                        | Fix                                                                                       |
| --------------------------- | ----------------------------------------------------------------------------------------- |
| **Composite FK**            | ON clause loop already handles arrays → add unit test                                     |
| **Quoted identifiers**      | implement `quoteIdent` (wrap if not /^\[a-z\_]\[a-z0-9\_]\*\$/)                           |
| **Two roles to same table** | when BFS sees *two equal‑cost paths*, prompt user which to use (`window.confirm` MVP)     |
| **Large DDL freeze**        | debounce parse 300 ms; if ddl.length > 50k then parse in a WebWorker (vite-plugin‑worker) |

---

## Done 🎉 — Deliverables

* `/dist` folder (`npm run build`) — static site; drop on S3/GH Pages.
* `/src/lib/*` — clean, unit‑tested BFS planner & parser.
* README with copy/paste DDL example and screenshot.

This plan keeps each step **atomic and verifiable**; you’ll have a working application as early as Stage 4 and a feature‑complete MVP by Stage 8.
