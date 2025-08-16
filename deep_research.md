Thanks for confirming. I’ll compile a comparison matrix of libraries for Postgres DDL parsing, code editor/autocomplete, and SQL formatting—all compatible with static Vite builds. I’ll also provide recommended architectures, key pseudocode, a risk register, and a short proof-of-concept plan.

I’ll get started and let you know when it’s ready for review.

# Designing a Client‑Side Schema‑Aware SQL Query Builder

**Goal:** Build a fully client-side web app (static files via Vite) where the user can paste PostgreSQL DDL (table schemas with foreign keys). The user can then type **object-graph paths** (e.g. `orders.customer.name`, `orders.*` etc.), and the app will generate **live SQL** queries (using `SELECT` with `LEFT JOIN` clauses) in real time. The core value is **schema-aware autocomplete** guiding users through foreign-key relationships, so they can “navigate” joins without writing SQL manually.

**Primary Users:** Developers/analysts familiar with their database schema who want faster query authoring and easily readable SQL output.

**Non-Goals (MVP):** No support for modifying schema (no writes or DDL execution), no server/backend or SQL execution, no authentication, and no support for non-Postgres dialects.

**Hard Constraints:**

* 100% **client-side** implementation (deliverable as static files).
* Input: pasted Postgres DDL (one or more `CREATE TABLE ...` statements including foreign key constraints).
* Output: human-readable, valid PostgreSQL SQL using **SELECT** and **LEFT JOIN** only (no other join types).
* Implementation in **TypeScript** (with React acceptable) and using only small, reliable front-end dependencies.

Below we detail prior art and building blocks for such an app, provide recommendations on libraries and architecture, and outline pseudocode and plans to implement the MVP.

## 1. Candidate Libraries for Key Features

We break down the required components and compare candidate libraries/tools for each:

* **(a) Postgres DDL Parsing to AST/Schema Graph** – Parse `CREATE TABLE` statements into a structured form (tables, columns, PK/FK relationships).
* **(b) Editor + Autocomplete** – Text editor component with support for custom, context-aware autocompletion of the path DSL.
* **(c) SQL Formatting** – Pretty-printing the generated SQL for readability, with proper capitalization/indentation and safe quoting of identifiers.

### (a) Postgres DDL Parsing Libraries (Browser-Safe)

Parsing SQL DDL in the browser is challenging but there are a few suitable libraries:

| Library                                   | License | Bundle Size / Footprint                                                         | Pros                                                                                                                                                                                                               | Cons                                                                                                                                                                                      | Example Usage Snippet |
| ----------------------------------------- | ------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| **pgsql-ast-parser** (TS)                 | MIT     | \~1.7 MB uncompressed (TypeScript source) <br> *(\~50–100KB gzipped estimated)* | *Pure TypeScript,* runs in browser (no native code). <br>*Produces typed AST* of PostgreSQL queries/DDL. <br>Used in `pg-mem` (in-memory PG emulator) – proven in practice. <br>*Built-in TS types* for AST nodes. | Not a full PG parser for every edge case (does not cover PL/pgSQL, and some “funky” syntaxes). <br>May not support newest PG features if not updated recently (last release 2 years ago). | \`\`\`ts              |
| import { parse } from 'pgsql-ast-parser'; |         |                                                                                 |                                                                                                                                                                                                                    |                                                                                                                                                                                           |                       |
| const ast = parse(\`                      |         |                                                                                 |                                                                                                                                                                                                                    |                                                                                                                                                                                           |                       |
| CREATE TABLE orders (                     |         |                                                                                 |                                                                                                                                                                                                                    |                                                                                                                                                                                           |                       |

```
id serial PRIMARY KEY,
customer_id int REFERENCES customers(id)
```

);\`);
console.log(ast\[0].CreateTable); // examine parsed table structure

````|
| **pg-query-emscripten** (WASM) | MIT    | ~600KB WASM (plus ~100KB JS wrapper) <br> _(loaded asynchronously)_ | Uses **PostgreSQL’s own parser** (C code) compiled to WebAssembly. <br>*100% spec-compliant:* can parse any valid Postgres SQL (including complex or future syntax). <br>Accurate extraction of constraints and relationships (since it’s the real PG parser). | Larger payload (WASM) and slightly longer initialization (must fetch & compile WASM). <br>No graceful error recovery during typing — input must be complete/valid or parse fails entirely (okay for static DDL input, but not for interactive partial code). <br>AST is a low-level PG parse tree (fields named after PG internals), not as developer-friendly without processing. | ```js
import Module from 'pg-query-emscripten';
const pgQuery = await Module();  // initialize WASM
const result = pgQuery.parse("CREATE TABLE ...;"); 
console.log(result.tree); // JSON parse tree output
``` |

Other options considered:

- **ANTLR or PEG.js Grammars:** E.g. an ANTLR4-based parser (like **`dt-sql-parser`** on NPM) can parse SQL. However, these tend to be heavy (include large generated parsers) and may not be fully PostgreSQL-specific. They often target big-data dialects and might require adapting grammar for PG DDL. Given the goal of a small, reliable dependency for a Vite app, these are less ideal.
- **Tree-sitter (WASM):** Tree-sitter has a SQL grammar and can parse in the browser. It’s fast and good with incomplete input. But off-the-shelf grammars might focus on SQL DML (SELECT/etc) more than DDL. Adopting tree-sitter for DDL would require a custom grammar or extending an existing one, which is complex for MVP. Also, integrating its AST with our schema logic adds work.
- **Native JS parsing (manual):** Writing a custom parser for a subset of Postgres DDL (just `CREATE TABLE` statements and constraints) is possible using regex/hand-rolled code, but this is error-prone and likely to miss edge cases. Given available libraries, it’s better to use a proven parser to accurately capture all foreign keys, including composite keys and schema qualifications.

**Recommendation – DDL Parsing:** Use **`pgsql-ast-parser`** for the MVP. It’s lightweight, runs entirely in TypeScript, and provides a convenient AST for tables, columns, and constraints. It should handle typical `CREATE TABLE` syntax (including inline and out-of-line foreign key definitions). The library is mature and was built for simulating Postgres in JS, so its coverage of DDL is good for our needs. As a backup or future enhancement, we can consider `pg-query-emscripten` if we encounter DDL syntax that `pgsql-ast-parser` can’t handle, since the WASM approach covers any valid syntax. Both are MIT-licensed, so no licensing issues.

### (b) Editor + Autocomplete Components

We need a text input for the user’s path DSL with **context-aware autocompletion** that suggests valid next tokens (tables, relationships, or columns) based on the current schema and path context. The two leading options are:

| Editor         | License | Bundle Size (approx)                           | Pros                                                        | Cons                                                         |
|----------------|---------|-----------------------------------------------|-------------------------------------------------------------|--------------------------------------------------------------|
| **Monaco Editor** (VSCode’s core) | MIT    | **Large:** ~5 MB added (uncompressed); ~0.8 MB min+gz for core + one language. | Full IDE-like experience; rich API and built-in features. <br>Offers built-in IntelliSense, tokenization, and a robust **completion provider API**. <br>Maintained by Microsoft (used in VSCode, very mature and stable). <br>Excellent for complex language support out-of-the-box (if we treat our DSL as a custom language or piggyback on SQL mode). | **Heavy bundle** – significantly increases app size. Harder to integrate into build (Monaco’s packaging can be complex, though newer webpack plugins help). <br>No official support for mobile/touch input (desktop-focused). <br>Many features we won’t use (overkill for a simple DSL). |
| **CodeMirror 6** (new modular version) | MIT    | **Lightweight:** ~300 KB core with basic features (additional plugins for autocomplete etc. add some weight). | Modern, modular design – load only what you need (language support as plugins). <br>**First-class mobile support** (contentEditable-based) and overall better performance on touch devices. <br>Highly customizable via extensions; we can implement our own completion logic with the @codemirror/autocomplete package. <br>Smaller footprint (core ~300KB vs Monaco’s hundreds of KB to MB), easier to keep bundle size small. | API is newer and less familiar – higher learning curve to set up custom autocompletion and language mode. <br>Not as many built-in language integrations (we’ll write a simple DSL support ourselves). <br>Project is still evolving (CM6 is relatively new, though stabilizing; documentation exists but fewer community examples compared to Monaco). |

Other considerations:
- **Ace Editor:** Lightweight (~98KB gzipped core) and mature. However, Ace is older, not maintained as actively, and its API for autocompletion is less modern. Given that CodeMirror 6 achieves similar lightweight footprint with a better architecture, Ace is probably not preferred for a new project.
- **Plain `<input>` with datalist/autocomplete:** Not sufficient here – we need rich, context-aware suggestions and likely multiline editing (the user might input multiple paths or a query with multiple selections), which a full editor component handles more naturally.

**Recommendation – Editor:** Use **CodeMirror 6** for the MVP. It satisfies the “small, reliable dependencies” constraint and is designed for precisely this kind of custom use-case. We can include the core editor and only the needed extensions: e.g. the autocomplete extension and perhaps basic styling. CodeMirror will let us programmatically provide suggestions based on our schema graph at runtime. Monaco, while powerful, would add significant bloat for features we mostly don’t need. (Monaco would make more sense if we were editing actual SQL or needed VSCode-level features, but our DSL is simpler.)

**Autocomplete Implementation:** With CodeMirror, we will create a custom **completion source** function that inspects the current text up to the cursor and suggests valid completions. Pseudocode for our completion logic:

- If the user is starting a new expression (e.g. the text box is empty or after a comma), suggest all table names from the schema.
- If the user has typed `TableName.` (including the dot): 
  - Look up that table in the schema graph.
  - Suggest its **columns** (for selection) and **foreign-key relationships** (as navigable paths).
  - For foreign keys, suggestions might use the referenced table’s name. For example, if `orders` has `customer_id` FK to `customers` table, suggest `customer` as a relationship. If multiple FKs to `customers` exist, we may suggest disambiguated labels like `billing_customer` vs `shipping_customer` (derived from FK column names or alias) to guide the user.
- If the user is two levels deep like `orders.customer.`:
  - Find the `customers` table (via `orders -> customer` relationship) and then suggest that table’s columns and further relations (if any).
- We will likely **prevent infinite recursion** – if a path would navigate back to a table already in the chain, we can omit that suggestion or indicate it’s not allowed, to avoid cycles.
- The suggestions will display as the user types, and on selecting one (or typing a dot), the input updates and new suggestions load for the next part.

Both Monaco and CodeMirror support these patterns (Monaco via `registerCompletionItemProvider`, CodeMirror via the `Autocomplete` extension’s [`completeFromList` or custom source](https://codemirror.net/6/docs/ref/#autocomplete)). The logic is custom but straightforward given our schema graph.

### (c) SQL Formatting Libraries

After generating the SQL string with the SELECT and LEFT JOINs, we want to format it nicely for the user. This includes line-breaking and indenting the SELECT list, JOIN clauses, etc., and consistent capitalization (keywords uppercased, maybe). We also must ensure proper quoting of identifiers (especially if schema or table names have capitals or reserved words).

Two main approaches:

| Library/Tool            | License | Size/Dependencies        | Pros                                               | Cons                                               |
|-------------------------|---------|--------------------------|----------------------------------------------------|----------------------------------------------------|
| **sql-formatter** (NPM package) | MIT    | ~2.7 MB unpacked (library code) <br> _(~150 KB min+gz)_ | Battle-tested JS library specifically for SQL formatting. <br>Supports **PostgreSQL dialect** explicitly (handles PG-specific syntax). <br>Pretty-prints with configurable options (indentation, uppercase/lowercase keywords, etc.). <br>Pure TS/JS and browser-friendly. | Adds another dependency (though relatively small). <br>Formatting is opinionated (defaults can be adjusted, but might not please everyone). However, it produces generally nice output. |
| **Prettier (SQL Plugin)** | MIT    | Large: Prettier core ~500 KB + SQL plugin ~100 KB | Prettier is a widely used formatter with a plugin for SQL. <br>Could format SQL in a style consistent with other code if user already uses Prettier. | Pulling in Prettier for just SQL is heavy. It’s overkill for a small app. <br>Prettier’s SQL plugin may not be as up-to-date with PG specifics as `sql-formatter` (which is purpose-built for SQL). <br>Integration in-browser requires bundling Prettier, increasing size a lot. |

Additionally:
- **pgFormatter (Perl)** – a PostgreSQL-specific formatter (open source) exists, but it’s a Perl tool (with a web service or CLI). Not usable in a client-only web app except via a wrapper like `pg-formatter-ts` which still requires a server or WASM of Perl (not feasible).
- **DIY formatting:** We could implement a simple formatting (like splitting joins into lines, etc.), but given the complexity of SQL syntax, it’s safer to use a proven library to handle edge cases (especially if we later support expressions or more complex queries).

**Recommendation – SQL Formatting:** Use **`sql-formatter`** (with the `language: "postgresql"` option) to pretty-print the generated SQL. This library is actively maintained (v15.6 as of 2025) and supports all common SQL dialects including Postgres. It will handle indenting the SELECT/FROM/JOIN clauses nicely. We can configure it to uppercase keywords (SELECT, FROM, ON, etc.) for readability. Example usage:

```js
import { format } from 'sql-formatter';
const rawSql = generateSql();  // our SQL generator output
const formattedSql = format(rawSql, { language: 'postgresql', keywordCase: 'upper' });
````

This yields output like:

```sql
SELECT
  o.id,
  c.name,
  c.email
FROM
  orders AS o
LEFT JOIN customers AS c ON o.customer_id = c.id;
```

If `sql-formatter` is too large for the bundle, we might consider a lighter approach, but since it’s <200KB gzipped and saves us writing a formatter, it’s acceptable. It’s MIT licensed and has over 400 dependents, indicating good community adoption.

**Safe Identifier Quoting:** We must ensure that table and column names appearing in the generated SQL are properly quoted if needed. Postgres identifiers that are lowercase and without special chars can be output as is; anything else (uppercase letters, spaces, reserved words) should be enclosed in double quotes. We can implement a utility to quote identifiers (e.g., check with a regex for safe vs needs quotes). `sql-formatter` by itself won’t add quotes if we don’t include them in the input string, so the responsibility is on our SQL generator to produce correctly quoted identifiers. (Alternatively, we could rely on the parser’s AST which might indicate original quoting, but a simple rule-based approach should suffice: quote if not all lowercase or contains non-alphanumeric underscore.)

## 2. Recommended Architecture for the MVP

Below is an overview of the proposed architecture, with components and data flow from the schema input to SQL output:

【※diagram】 The architecture consists of distinct components for parsing, state management, suggestion logic, and output formatting:

* **Schema Input Component** (DDL Textarea):

  * The user pastes their Postgres DDL (one or more `CREATE TABLE ...` statements) into a multiline textarea.
  * On submission (or as they paste), the DDL text is sent to the **DDL Parser**.

* **DDL Parser** (`pgsql-ast-parser`):

  * Parses the DDL script into an AST (list of statements).
  * We then traverse the AST to build an in-memory **Schema Graph** representation:

    * A list of **Table** objects (with table name, list of columns, primary key info, etc.).
    * Within each Table, a list of **Foreign Key relationships** (each with: local FK column(s), referenced table name, referenced column(s), and maybe a derived relationship name).
    * Possibly also build a reverse index of which table has foreign keys *to* this table (for future use, though in this MVP we primarily traverse from base outwards).
  * The Schema Graph is stored in a central state (for example, a React context or a simple global variable/module that the other components can access). This state is reactive – when updated, it triggers the rest of the app to use the new schema.

* **Path Editor Component** (with CodeMirror + Autocomplete):

  * This is the main UI where the user types the object-path query (e.g. `orders.customer.name, orders.total` etc.).
  * CodeMirror is configured with a **custom language mode** (or a simple placeholder mode, since our syntax is just identifiers and dots) and, importantly, a **completion source** that uses the Schema Graph.
  * As the user types, at each keystroke or when a completion is requested (usually triggered by typing a dot `.` or pressing Ctrl+Space), the editor invokes our autocomplete logic:

    * Our code looks at the **current token** or the text before the cursor. For example:

      * If the user has typed nothing (cursor at start), we suggest all table names.
      * If they typed `orders.` – we identify `orders` as a table (using the Schema Graph) and suggest its columns and relationships.
      * If they typed `orders.cus` – we identify `orders` and then filter suggestions (columns/relations) that start with "cus" (case-insensitive matching).
      * If an ambiguous token is encountered (e.g. user typed `orders.customer` and `orders` has two FKs to `customers`), we **do not auto-complete fully** but we can show both options in the suggestions dropdown (like `billing_customer` vs `shipping_customer`). The user can pick one, or we might require them to keep typing to disambiguate.
    * Once a suggestion is chosen (or the user types a valid token and a dot), the text is updated. The component can optionally display inline hints (for example, after typing `orders.` we might show a transient hint like “← columns | → join to related table” to educate the user that selecting a column will end the path, pressing dot will continue the join chain).
    * We will also manage **breadcrumb navigation**: as the path gets longer (`orders.customer.address.city`), it might be useful to visually separate the segments. For MVP, we might simply rely on the dot notation, but a UI enhancement could show each segment as a chip that can be clicked to remove or edit that segment.

* **SQL Generator:**

  * As soon as the user’s input constitutes a valid selection path (or multiple paths), the app generates the corresponding SQL query on the fly.
  * This can be done in a function that takes the current **Schema Graph** and the **Path expression(s)** and produces a SQL string. We outline algorithms for this in the pseudocode section below.
  * In a React app, the SQL string could be stored in state and updated on each change of the input field (with debouncing if needed). In a simpler implementation, an event listener on the input can trigger regeneration.
  * **Join Planning:** The generator determines which tables need to be joined to fulfill the path. It deduplicates joins (if two paths share the same join, include it once) and assigns aliases consistently.

* **SQL Formatting Component:**

  * We take the raw SQL from the generator and pass it through the formatter (`sql-formatter`) to produce nicely indented SQL text.
  * This formatted SQL is displayed in a read-only output panel (could be a `<pre>` or perhaps a read-only CodeMirror instance for syntax highlighting).
  * The output updates in real time as the user edits the path input.

* **Error Handling & Warnings:**

  * If the user enters a path that the system cannot resolve (e.g. a table or field name that doesn’t exist, or an ambiguous relationship without disambiguation), the SQL Generator can indicate an error (maybe output a comment or an error message instead of SQL).
  * The UI might also underline unknown tokens in red squiggly (like a linter). Since building a full parser for the DSL is easy (it’s just dots and identifiers), we can quickly validate the input and provide feedback if, say, “orders.custmer.name” doesn’t match any relationship (typo “custmer”). This improves UX.

**State Management:** The flow is essentially unidirectional:

* Schema Graph state (from DDL) feeds into Autocomplete and also into the SQL Generator.
* Query Input state feeds into SQL Generator.
* Then SQL output is derived.

We can implement this with React using top-down props (pass schema and query into a generator component) or using a state management solution (Context or Redux) if it grows complex. For MVP, simple React state and context should suffice (e.g., store the schema in a context provider after parsing; the editor component consumes it for suggestions; the output component consumes both schema and query to show SQL).

**Web Worker consideration:** Parsing a large DDL (hundreds of tables) could be a bit heavy. `pgsql-ast-parser` is fairly fast in JS, but if the schema is huge (say 1000 tables, 10k lines), parsing on the main thread might cause a noticeable lag. If needed, we could offload DDL parsing to a Web Worker thread to keep the UI responsive. However, given this is a one-time action (when user pastes the schema), a brief pause is acceptable. We can start without a worker and measure performance. The join+format generation per keystroke should be very fast (the queries are much smaller than the whole schema), but if needed, that too could be debounced or moved to a worker. The architecture can accommodate this if performance testing shows issues (for example, have a `parserWorker` that posts back the schema graph).

## 3. Key Algorithm Pseudocode

This section provides pseudocode for core logic: (i) building the foreign key graph from the parsed AST, (ii) resolving a path expression to a join plan, and (iii) generating the SQL SELECT statement with deduplicated LEFT JOINs and aliases.

### (i) Build Schema Graph from DDL AST

After using the parser on the DDL, we need to extract tables, columns, and constraints:

```ts
// Assuming parseDDL returns an AST array of Statement nodes for the DDL.
const schemaGraph = { tables: {} }; 
// schemaGraph.tables will map tableName (possibly with schema prefix) -> Table object

for (const stmt of parseDDL(ddlText)) {
  if (stmt.type === 'CreateTable') {
    const tableName = stmt.name;  // e.g. "orders" (consider schema if present)
    const table: Table = {
      name: tableName,
      columns: {},        // map column name -> { type, etc. }
      primaryKey: [],     // array of column names forming PK (maybe empty if none declared)
      foreignKeys: []     // list of FK relations
    };

    // Process column definitions
    for (const colDef of stmt.columns) {
      table.columns[colDef.name] = { dataType: colDef.dataType /*, ... */ };
      // Check inline constraints on the column
      for (const colConst of colDef.constraints) {
        if (colConst.type === 'PRIMARY KEY') {
          table.primaryKey.push(colDef.name);
        }
        if (colConst.type === 'REFERENCES') {
          // Inline FK constraint
          const refTable = colConst.refTable;        // referenced table name
          const refCols = colConst.refColumns;       // referenced column(s)
          table.foreignKeys.push({
            name: deriveRelationName(colDef.name, refTable), // e.g. "customer" from "customer_id"
            columns: [colDef.name],
            refTable: refTable,
            refColumns: refCols
          });
        }
      }
    }

    // Process table-level constraints (these could include PK, FKs spanning multiple cols, etc.)
    for (const tblConst of stmt.tableConstraints) {
      if (tblConst.type === 'PRIMARY KEY') {
        table.primaryKey = tblConst.columns;  // list of column names
      }
      if (tblConst.type === 'FOREIGN KEY') {
        // Multi-column or single-column FK defined at table level
        const fkCols = tblConst.columns;       // array of local column names
        const refTable = tblConst.refTable;    // referenced table name (string)
        const refCols = tblConst.refColumns;   // array of referenced column names
        table.foreignKeys.push({
          name: deriveRelationName(fkCols[0], refTable), // derive a name from first col or use constraint name if available
          columns: fkCols,
          refTable: refTable,
          refColumns: refCols
        });
      }
    }

    schemaGraph.tables[tableName] = table;
  }
}
```

In the above pseudocode:

* We iterate over each parsed statement; if it’s a `CREATE TABLE`, we instantiate a Table object.
* We go through each column definition. If a column has an inline `REFERENCES` clause (e.g. `customer_id INT REFERENCES customers(id)`), we add a ForeignKey entry. We use a helper `deriveRelationName(colName, refTable)` to name the relationship. For instance, `colName = "customer_id"` referencing table `customers` might produce relation name `"customer"`. A simple rule is to remove known suffixes like `_id` or `_fk`. If the column name is the same as the referenced table with an `_id` suffix, this works well. (If not, or if multiple FKs reference the same table, we might default to using the actual constraint name or concatenate something like `refTableName + "_" + (index)`.)
* We also capture table-level foreign keys (these handle multi-column FKs or scenarios where the DDL uses a separate `CONSTRAINT ... FOREIGN KEY (...) REFERENCES ...` line).
* `primaryKey` is recorded (for one or multiple columns). If no PK is found, the array stays empty – we’ll treat that appropriately in join generation.
* We don’t explicitly store unique constraints or other info since not needed for query building, but we could if needed (e.g. to treat unique keys similar to PK for joins).

We might also want to build a quick lookup for foreign key by name for each table (e.g. an index of `table.foreignKeyByName`) to make path resolution easier. The `name` we assign (like `"customer"` for the relationship) will be used as the key the user types in the path.

**Composite Foreign Keys:** In case of multi-column FKs, our ForeignKey object holds an array of columns and array of refColumns. We will need to join on all column pairs. For path navigation, we treat it as one relationship (the user doesn’t need to know the details if we assume one logical link). We should ensure the `name` represents the relationship (perhaps just use referenced table name or constraint name). The autocomplete can still suggest just one item for the multi-col FK.

**Multiple Schemas:** If the DDL contains schema-qualified table names (e.g. `CREATE TABLE sales.orders ...` and `public.orders ...`), we include the schema in the table identifier in `schemaGraph`. For example, table key could be `"sales.orders"`. In suggestions, we might show the schema prefix if there are duplicates (or always, depending on user preference). For MVP, we can assume all tables are unique names or that the user will include schema in the DDL name if needed. It’s a detail we note in Risks.

### (ii) Resolve Path to JOIN Plan

Given an input path like `"orders.customer.address.city"` or `"orders.customer.name"`, we need to resolve it against the schema graph, determining which tables to join and in what sequence. We outline a function `resolvePath(baseTableName, pathTokens[])`:

```ts
function resolvePath(baseTableName: string, tokens: string[]): JoinPlan {
    // tokens is an array of identifiers from the path, including potentially a final '*' or column.
    // e.g. "orders.customer.name" -> tokens = ["orders", "customer", "name"]
    // e.g. "orders.*" -> tokens = ["orders", "*"]

    const plan: JoinPlan = { baseTable: baseTableName, joins: [] }; 
    let currentTable = schemaGraph.tables[baseTableName];
    if (!currentTable) throw new Error(`Unknown table: ${baseTableName}`);

    // Determine if last token is a column/star or a relationship:
    const lastToken = tokens[tokens.length - 1];
    const pathTokens = tokens.slice(1);  // tokens after the base table
    let selection: { table: Table, columns: string[] | '*' };

    if (lastToken === '*' || currentTable.columns[lastToken]) {
        // Path has no relationships at all (base.* or base.column)
        if (tokens.length === 2) {
            // tokens[0] is base, tokens[1] is '*' or column
            selection = {
                table: currentTable,
                columns: (lastToken === '*') ? '*' : [lastToken]
            };
            // No joins needed in this case
            return { baseTable: baseTableName, joins: [], selection };
        } else {
            // If last token is a column but tokens length > 2, that means all prior tokens were relationships and last is column of final table
            selection = { table: null as any, columns: [] }; 
            // We'll fill selection after resolving relationships
        }
    } else {
        // Last token is not '*' and not a column of the base, so it must be intended as a relationship (if path continues beyond base)
        selection = { table: null as any, columns: '*' }; 
        // By default, if the path ends in a relation name (like "orders.customer"), we might interpret it as selecting all columns of that related table.
        // But our DSL examples always ended in either '*' or an actual column. We'll assume the user ends with either a column or '*' for final output.
    }

    // Traverse through each relationship token (excluding the final column if present)
    for (let i = 1; i < tokens.length; i++) {
        const token = tokens[i];
        const isLastToken = (i === tokens.length - 1);

        // If we've reached the last token and it was identified as a column above, break out
        if (isLastToken && (token === '*' || currentTable.columns[token])) {
            // This is a column selection (handled outside loop)
            break;
        }

        // Otherwise, token should correspond to a foreign key relation name on currentTable
        const fkRelation = currentTable.foreignKeys.find(fk => fk.name === token || fk.refTable === token);
        // We try matching the relation by the name we derived or by referenced table name.
        if (!fkRelation) {
            throw new Error(`Path resolution error: '${token}' is not a valid relationship on ${currentTable.name}`);
        }
        // If multiple fks could match (ambiguous), ideally we would handle earlier, but here we assume it’s unique (or first match).
        // (In practice, we'd catch ambiguity in the autocomplete stage and not allow an ambiguous token to be entered without clarification.)

        // Add join to plan
        const targetTable = schemaGraph.tables[fkRelation.refTable];
        if (!targetTable) {
            throw new Error(`Referenced table ${fkRelation.refTable} not found in schema`);
        }
        plan.joins.push({
            fromTable: currentTable,
            toTable: targetTable,
            viaForeignKey: fkRelation
        });
        currentTable = targetTable;

        // If this is the last token in the path (and it's a relationship, meaning path ends at a table), we set selection to all columns of this table by default
        if (isLastToken) {
            selection.table = currentTable;
            selection.columns = '*';
        }
    }

    // If the last token was a column (and not '*' handled earlier):
    if (lastToken !== '*') {
        if (currentTable.columns[lastToken]) {
            // It's a valid column of the current table
            selection.table = currentTable;
            selection.columns = [ lastToken ];
        } else {
            throw new Error(`Column ${lastToken} not found in table ${currentTable.name}`);
        }
    }

    plan.selection = selection;
    return plan;
}
```

**Explanation:**

* We take the base table and each subsequent token. For each intermediate token, we assume it’s a relationship (foreign key) name, and we find the corresponding ForeignKey in the current table.
* We switch `currentTable` to the referenced table after adding a join to the plan.
* When we reach the final token:

  * If it was `*`, we mark the selection as all columns of the current table.
  * If it was a specific column name, we mark selection as that column of the current table.
* We accumulate `plan.joins` as a list of join steps (with fromTable, toTable, and the foreign key used).
* We throw errors if something is not found (in practice, these would be caught and could be shown to the user as path errors).

**Ambiguity handling:** In the above, if `fkRelation` is ambiguous (e.g. two foreign keys with the same referenced table), our simple find might grab the first. In an MVP, we might do that and document that it picks one arbitrarily, but that’s not ideal. A better approach is to detect before selecting:

* We can name each foreign key relation distinctly in the schema graph (e.g., use the actual constraint name or a composite name like `customer_via_billing_id` vs `customer_via_shipping_id`). Then the user’s input must match one exactly. Our autocomplete will list the distinct names so the user can’t enter an ambiguous token.
* Alternatively, allow the ambiguous generic name (`customer`) and if entered, present a UI to choose which one. But that complicates the input model. For MVP, using distinct relation names in suggestions is simplest.

So, we ensure `foreignKeys.name` in the schema graph is unique per table. E.g., if `orders` has two FKs both referencing `customers`, we might name one `customer_billing` and the other `customer_shipping` or similar. Or simply use the FK column name itself as the relation name (which would be `billing_customer` if column is `billing_customer_id`). That way the user types `orders.billing_customer.name` vs `orders.shipping_customer.name`. This disambiguates naturally. We will adopt that naming strategy in `deriveRelationName()` during graph building.

### (iii) Generate SQL with LEFT JOINs and Aliases

Now we convert the join plan (from (ii)) plus the selection info into a SQL query string. We need to:

* Assign aliases to each table (especially since the same table might appear twice via different relationships, or to simplify SQL reading).
* Construct the SELECT list (the columns to output).
* Construct the FROM and LEFT JOIN clauses with ON conditions for each foreign key.

Pseudocode for SQL generation:

```ts
function generateSql(plan: JoinPlan): string {
    const { baseTable, joins, selection } = plan;
    const clauses: string[] = [];

    // Alias assignment:
    const aliasMap: Map<string, string> = new Map();
    let aliasCounter = 1;
    function getAlias(tableName: string): string {
      if (aliasMap.has(tableName)) {
        return aliasMap.get(tableName)!;
      }
      // Propose an alias (e.g. first letter of table, or a short abbreviation)
      let alias = tableName[0].toLowerCase();
      if (aliasMap.has(alias) || usedAliasLetter(alias)) {
        // If already taken, append counter or use next letters
        alias = tableName.substring(0, 2).toLowerCase();
        if (aliasMap.has(alias) || usedAlias(alias)) {
          // Fallback: use a generic alias like t1, t2
          alias = 't' + aliasCounter++;
        }
      }
      aliasMap.set(tableName, alias);
      return alias;
    }
    function usedAliasLetter(letter: string): boolean {
      // Check if any existing aliasMap value == letter
      for (let v of aliasMap.values()) { if (v === letter) return true; }
      return false;
    }

    // Base table alias
    const baseAlias = getAlias(baseTable);
    clauses.push(`FROM ${quoteIdent(baseTable)} AS ${baseAlias}`);

    // Joins
    for (const join of joins) {
      const toTable = join.toTable.name;
      const toAlias = getAlias(toTable);
      const fromAlias = getAlias(join.fromTable.name);  // fromTable should already have an alias
      // Build ON clause using each pair of columns in the FK
      const conditions: string[] = [];
      join.viaForeignKey.columns.forEach((col, idx) => {
        const refCol = join.viaForeignKey.refColumns[idx];
        conditions.push(`${fromAlias}.${quoteIdent(col)} = ${toAlias}.${quoteIdent(refCol)}`);
      });
      clauses.push(`LEFT JOIN ${quoteIdent(toTable)} AS ${toAlias} ON ${conditions.join(" AND ")}`);
    }

    // Select clause
    let selectCols: string[] = [];
    if (Array.isArray(selection.columns)) {
      // specific columns
      for (const col of selection.columns) {
        const alias = getAlias(selection.table.name);
        selectCols.push(`${alias}.${quoteIdent(col)}`);
      }
    } else if (selection.columns === '*') {
      // select all columns from selection.table
      const alias = getAlias(selection.table.name);
      // We list all columns explicitly to avoid using "table.*" (for clarity/stability, though we could use star if desired).
      // But using * can cause ambiguous col names if multiple tables have same col. It's safer to qualify each column.
      for (const colName in selection.table.columns) {
        selectCols.push(`${alias}.${quoteIdent(colName)}`);
      }
    } else {
      // If selection covers multiple segments (like if user input multiple paths), handle separately.
      // (Extension: if user can input multiple comma-separated paths, we'd merge their selections. For simplicity, assume one path here.)
    }

    // Construct final SQL string
    const selectClause = "SELECT " + selectCols.join(", ");
    const fromClause = clauses[0];
    const joinClauses = clauses.slice(1).join("\n");  // each join on new line
    const sql = selectClause + "\n" + fromClause + ((joinClauses) ? "\n" + joinClauses : "");
    return sql;
}
```

Key points in this pseudocode:

* **Aliases:** We create a short alias for each table. We try to use the first letter of the table name if possible. If that letter is already used, we try the first two letters, or fall back to a generic `t{n}` sequence. This ensures unique aliases. We store `aliasMap` keyed by table name. This simple scheme works for most cases, but for very similar table names it might produce confusing aliases (e.g. `user` and `user_address` both get alias `u` then `us`). It’s acceptable as long as they’re unique. The aliasing is deterministic given the order tables appear in the join plan.

* **Quoting:** `quoteIdent(name)` will add double quotes around identifiers that need it (implement per earlier discussion).

* **SELECT list:** If the user selected a specific column (like `orders.customer.name` ending in `name`), then `selection.table` is `customers` and `selection.columns = ["name"]`. We output `customer_alias."name"`. If `*` was indicated (like `orders.customer.*`), we include all columns of the `customers` table. For readability, we might actually enumerate them (as done above) rather than using `*`, to avoid ambiguous names in multi-join situations. Alternatively, we *could* output `customer_alias.*` directly if we trust the user knows what they’re doing. But explicit columns is more “learnable output”.

* If the DSL allowed multiple paths in one query (e.g. user types `orders.id, orders.customer.name` to get two columns), we would extend this to merge selections:

  * We’d collect all needed joins from all paths (avoiding duplicates), then output each selected column. For MVP, it’s unclear if the user can input multiple paths at once (the examples hint maybe yes, because `orders.*` vs `orders.customer.name` are separate examples). If they want multiple fields, they might separate them by comma. We could support that by splitting input on commas/outside of any other structure, then resolving each sub-path and merging.
  * We should design the DSL such that the base table must be the same for all paths in one query (mixing base tables would require a cross join, out of scope). Likely, the user will have one base and navigate from it.
  * Implementation: parse the input by commas into multiple paths, resolve each, unify the join plan and selections.
  * We’ll note this in the POC plan as a possible extension.

* **Deduplicating joins:** Our approach ensures that if the same foreign key relation is used twice, it only appears once in `plan.joins` or we could check for duplicates before pushing. In the resolution function, if we allowed multiple paths, we would union the join sets. We have to be careful: the same table could be reached via different paths (e.g., if user selects two different relationships that both ultimately reference the same table through different routes). In that case, we cannot deduplicate because the ON clauses differ. Deduping should happen only when the exact same relationship is traversed multiple times (which usually wouldn’t occur unless the user repeated a path).

  * Example: selecting `orders.customer.name` and `orders.customer.email` – the path `orders->customer` is the same, so we join customer once and select two of its columns. That’s the ideal deduplication we want (we wouldn’t list two separate joins).
  * Our generation pseudocode as written already handles that: both selections would yield one join and two selectCols (name, email).
  * If two paths needed `orders -> customer` and also `orders -> address`, those are different joins (even if address and customer were the same table name hypothetically, which they are not in this example). So we’d have two join entries.

* **Stable ON clauses:** By systematically using the FK info, our ON conditions are stable and unambiguous: e.g. always `orders_alias.fk_column = customer_alias.pk_column`. If composite, we join on all pairs in order. We might consider ordering by column name to be extra stable (so that if the parser gave columns in a different order, we still output consistently sorted conditions, though typically the parser preserves the order they were written which should correspond to logical pairing).

Once we have the raw SQL string from `generateSql(plan)`, we run it through the formatter for final output as described.

## 4. Risk Register and Mitigations

Building this tool involves handling various edge cases. Below is a list of potential risks and how to mitigate them:

* **Composite Primary Keys / Foreign Keys:** Tables with composite keys or foreign keys spanning multiple columns add complexity to join generation. **Mitigation:** The schema graph should store arrays of columns for composite FKs. Our SQL generator already concatenates multiple join conditions with `AND` to handle composite keys. We should test with an example (e.g. a foreign key on (country, state) referencing a location table composite PK) to ensure the logic works. Autocomplete can treat it as one relationship (the user doesn’t need to know it’s composite). Ensure the \* order is preserved or consistent for matching columns to refColumns.

* **Missing Primary Keys:** Some tables might not have a primary key defined. PostgreSQL allows foreign keys to reference columns that have a UNIQUE constraint (not necessarily the primary key). If our parser doesn’t mark anything as PK, but a foreign key exists, it likely means the referenced column is unique. **Mitigation:** We can treat that as a valid join target anyway. We will join on the columns provided. The only issue is if a table has neither PK nor any unique constraint referenced – then a foreign key could not be defined (Postgres would reject it), so we won’t encounter a truly non-unique reference. If a table has no PK and is not referenced by any FK, it doesn’t affect our logic except we might not have a single obvious identifier to show for it. No special action needed, just join conditions as given.

* **Ambiguous Relations (Multiple FKs to same table):** As discussed, a table might have two or more foreign keys pointing to the same target table (e.g., `orders` with `billing_customer_id` and `shipping_customer_id` both referencing `customers`). In the DSL, if the user types `orders.customer.name`, this is ambiguous. **Mitigation:** In our schema graph, assign distinct relation names. For example, use the FK column name (minus `_id`) as the relation name: `orders.billing_customer` vs `orders.shipping_customer`. Our autocomplete will list both as options. The user then explicitly chooses one, eliminating ambiguity. We should **avoid using a generic name like the target table name** if it’s not unique. If we ever detect duplicate `fk.name` for a table, append a suffix or otherwise differentiate. (Another mitigation: if the user does type an ambiguous token, we could highlight it and prompt them to clarify, but preventing it via naming is easier.)

* **Unquoted or Unusual Identifier Names:** Schemas might include quoted identifiers with uppercase or spaces (e.g. `CREATE TABLE "User Accounts" (...)`). If our parser captures the raw name including quotes or case sensitivity, we must preserve that in output. **Mitigation:** Use a robust quoting strategy in SQL generation. Always quote identifiers unless we are certain they are simple and lowercase. This guarantees correctness at the expense of verbosity. The `sql-formatter` will likely output quoted identifiers as given. We just need to ensure to feed them properly quoted. We should also test unusual names (like reserved words as column names) to confirm our method works.

* **Schemas and Namespaces:** If DDL from multiple schemas is provided, table names might not be unique (e.g., `public.orders` and `sales.orders`). Our current DSL doesn’t have a syntax for schema prefix (since dot is used for relationships). **Mitigation:** We have a few options:

  * Require that all table names are unique across the pasted DDL, and prefer the default schema. This might be acceptable for MVP (user can paste one schema at a time).
  * Or allow a special notation for schema, e.g., the user could type `"schema.table"` in quotes as the first token or use a separator like `:` (not very elegant). This could complicate the DSL.
  * Simpler: if we detect name collision, we could internally qualify one set with schema in suggestions, like suggest `sales.orders` as a single token name (including the dot in the string). However, our parser might treat `schema.table` as separate tokens if not careful. We might treat the schema name as part of the table name string in our graph (e.g. store key as `sales.orders`). Then the DSL token would have to literally be `sales.orders` (with a dot). This might confuse the autocomplete logic unless we handle it specially (like treat the first dot as schema delimiter).

  **MVP approach:** assume one schema or no name conflicts. Note it as a limitation. If needed, enforce by error message if duplicate table names found across schemas. As mitigation, users can prepend schema name in the DDL to differentiate (our graph keys would include it). We will document that full support for multi-schema navigation can be added later.

* **Cycles in Relationships:** Cyclic foreign keys (table A has FK to B, B to A, or self-referential FKs) can lead to infinite or very deep join paths if not constrained. A user could theoretically navigate in circles (`a.b.c ...` back to `a`). **Mitigation:** We should detect if a table is about to repeat in a path and stop offering that completion (or flag it as cycle). For example, if `orders` -> `customers` and `customers` has an FK back to `orders` (unusual, but possible in a many-to-many join table scenario), and the user already navigated to `customers`, we should probably not suggest going back to `orders` as that would create a cycle. Or if we do, we must alias it differently and be very careful (this becomes a query with two instances of `orders`). For MVP, better to prevent cycles: set a reasonable join depth limit (maybe 3 or 4 hops) and do not suggest a relation that leads to a table already in the path. We can maintain a visited set during suggestion generation to avoid suggesting already-traversed tables.

* **Performance (Large Schemas):** If hundreds of tables are present, our parser and UI could slow down:

  * Parsing large DDL: **Mitigation:** possibly use a Web Worker as mentioned if needed. Also, `pgsql-ast-parser` is fairly efficient in JS, and one-time parse is okay. We can also ask users to paste only necessary tables if performance suffers.
  * Autocomplete suggestion size: If a table has, say, 100 columns and 20 foreign keys, suggesting all of those at once after a dot could be a long list. This is still manageable, but we might want to group suggestions or allow filtering as the user types more letters. CodeMirror’s autocomplete will filter by prefix automatically. Also we can show sections (like maybe show columns first, then relations). But MVP can just show an alphabetized list.
  * Rendering the output SQL for huge selections (like `orders.*` where orders has 50 columns, plus joined table with 50 columns): The SQL string could become very large. That’s fine, but the formatter will make it multiline and readable. The app should handle a few hundred columns output (just text, likely fine).
  * Memory: storing the schema graph for hundreds of tables is negligible (a few MB at most), so not an issue.

* **Dependency Licensing & Longevity:** All chosen libraries are open-source and permissive:

  * Parsers: both `pgsql-ast-parser` and `pg-query-emscripten` are MIT licensed. `pgsql-ast-parser` has not been updated in \~2 years, but it’s fairly complete for SQL92 and Postgres dialect up to that point. Its maintainer created it for a specific project (pg-mem), so it’s likely stable. If an issue arises with newer syntax (say `GENERATED AS IDENTITY` or similar newer DDL features), we might have to contribute a fix or use an alternative. The community HN discussion shows interest in keeping such tools updated, and alternatives like libpg\_query are available if needed.
  * CodeMirror 6 is MIT and actively maintained (Marijn Haverbeke is actively improving it; many companies use it and even Chrome DevTools is considering adopting it, indicating longevity). It’s in beta but nearing maturity, and API changes are slowing down.
  * Monaco is MIT and very actively maintained by Microsoft (used in VSCode). No risk of abandonment, though its API is tied to VSCode’s evolutions (which is fine).
  * `sql-formatter` is MIT, and as of 2025 it’s on v15 with frequent updates (published 2 months ago per NPM). It has good TypeScript support (we saw it includes type declarations) and is likely to remain maintained (SQL formatting is a common need).
  * Our own glue code will be TypeScript, which helps with maintainability and catching errors early. We should write unit tests for critical pieces (e.g., the path resolver and SQL generator) especially to handle tricky cases (composite keys, multiple fks).

* **Security:** Because this is a client-side app and not executing any SQL, the main security consideration is the user’s data. Pasting schema DDL in the browser is safe as long as we don’t transmit it anywhere (we won’t; all processing is local). We should ensure that large inputs don’t freeze the UI (performance) which we addressed above. Also, consider XSS in case the user’s identifiers contain malicious content (unlikely, but if someone named a table with `<script>` in the name, when we display the SQL, we should present it in a `<code>`/text context so it doesn’t execute as HTML). Using proper escaping in any HTML output or just using textContent will handle that.

In summary, the biggest risks are around correctly handling all the schema variations (we will test on some real-world schemas to validate) and keeping the UI responsive. The mitigations above will guide development and testing of the MVP.

## 5. Minimal Proof-of-Concept Implementation Plan (2–3 Days)

To de-risk the project, we plan a minimal proof-of-concept that can be built in a short timeframe (\~2 days of work). The goal of the POC is to demonstrate the end-to-end flow: parse input -> navigate a simple path -> output correct SQL. We will focus on the simplest case first, then extend.

**Day 1: Project Setup & Basic Parsing**

* **Setup Vite + TypeScript project:** Initialize a new Vite app (could be React + TS). Success criteria: able to run `npm run dev` and load a basic page.
* **Integrate DDL Parser:** Install `pgsql-ast-parser`. Create a module or function `parseSchema(ddlText)` that uses it to parse input DDL and build the schema graph.

  * Test with a simple schema (2–3 tables, one PK/FK).
  * Success: calling `parseSchema("CREATE TABLE ...")` returns a JavaScript object representing tables and foreign keys. Log this to console for verification.
* **Display Schema Summary (optional):** For debugging, show a list of parsed tables on the page (just to confirm parse results). Not essential for final product but helps in POC to see we got the relationships right.

**Day 2: Path to SQL Generation**

* **Implement Path -> SQL logic:** Using the schema graph, write a basic resolver that takes an input string like `"orders.customer.name"` and produces a SQL string.

  * Start with a very simple assumption: exactly one path, ending in a column.
  * Hardcode some alias logic if needed (or even skip aliasing in POC for simplicity, using full table names).
  * Success: For a known small schema (e.g. orders→customers), typing that path yields a correct SQL `SELECT orders.customer_id, customers.name FROM orders LEFT JOIN customers ...` (for POC, we might include the FK column and the joined column).

* **Simple UI for Query Input:** Use a plain `<input>` or `<textarea>` for the path DSL input in the POC.

  * Bind a change event to call the resolver and update an output `<pre>` with the SQL.
  * Success: When the user types `orders.customer.name` (and maybe presses Enter or a "Generate" button), the output updates with the SQL string.

* **Basic Autocomplete (optional on Day 2):** If time permits, integrate CodeMirror and get a basic autocomplete working for, say, table names.

  * This might involve installing `@codemirror/basic-setup` and `@codemirror/autocomplete`.
  * For POC, even a manual trigger (like pressing Ctrl+Space to show suggestions after typing `orders.`) is fine.
  * Success: After typing `orders.` and hitting Ctrl+Space (or automatically), the suggestions show `customer` (assuming our schema from Day 1 includes that relation).
  * If this is too much for Day 2, we can simulate autocomplete by hardcoding a datalist or a button that appends `.customer` etc., just to demonstrate the concept.

**Day 3: Refinements & Testing (if a third day is available):**

* **Integrate CodeMirror fully:** Replace the plain input with a CodeMirror editor configured for our DSL. Implement the completion source function properly using the schema graph.

  * Success: As the user types, relevant suggestions appear at each dot-separated segment.
* **SQL Formatting:** Add `sql-formatter` and format the output SQL before displaying.

  * Success: The output SQL is nicely indented and uppercased. (Verify on multi-join scenario.)
* **Edge-case Testing:** Try a composite FK in the schema, or multiple FKs, to see if our code handles it. If not, note the limitation but ensure it doesn’t break (maybe log a warning).
* **UI polish (minimal):** Display any errors from parsing or resolution to the user (e.g., if parse fails or path can’t be resolved, show a small error message instead of SQL).
* **Success Criteria for POC:** Paste a small schema (two tables with a foreign key). The app suggests the joinable path and generates a correct SQL query that matches expectation. This proves the concept is viable.

Each of these steps will be verified manually. Because this is an interactive tool, a lot of the validation will be by trying different inputs. We’ll create a few sample DDLs for testing:

* A simple one-table no-FK (ensure no joins happen).
* Two tables with one FK (the basic scenario).
* A chain of three tables (A -> B -> C) to test multi-hop.
* Two FKs from one table to another (to test disambiguation naming).
* Composite key scenario.

By the end of the POC, we should have a clear idea of any performance issues and have resolved the major integration challenges (parsing in browser, CodeMirror config). From there, we can iterate to complete the full MVP with confidence.
