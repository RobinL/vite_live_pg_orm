
# **Schema-Aware SQL Query Builder: A Client-Side Web Application Design Report**

## **1\. Executive Summary**

This report details the technical design and architectural recommendations for a fully client-side web application aimed at streamlining PostgreSQL SQL query authoring. The application's core value lies in its schema-aware autocomplete, which guides users through database relationships, enabling the generation of live SELECT and LEFT JOIN SQL statements in real-time without manual SQL writing. This approach directly addresses the needs of developers and analysts seeking faster query authoring and transparent, learnable SQL output.

The proposed solution leverages the pgsql-parser ecosystem for high-fidelity PostgreSQL DDL parsing and schema graph construction, ensuring accurate representation of tables, columns, primary keys, and foreign keys. For the interactive editor and schema-aware autocomplete, CodeMirror 6 is recommended due to its modularity, small bundle size, and robust extensibility for dynamic suggestions. SQL generation will utilize a custom algorithm that resolves object-graph paths into a join plan, with pgsql-deparser and sql-formatter ensuring readable and valid PostgreSQL SQL output.

The architecture emphasizes a clear, client-side state flow, from DDL parsing to graph generation, autocomplete, and SQL emission. Key risks, including composite foreign keys, ambiguous relations, and performance on large schemas, have been identified, and mitigation strategies are outlined. A minimal proof-of-concept plan, estimated at 2-3 days, demonstrates the feasibility of this innovative tool. The comprehensive design ensures a responsive, intuitive, and highly valuable application that empowers technical users by making complex SQL navigation effortless and transparent.

## **2\. Introduction to the Schema-Aware SQL Builder**

### **Project Vision and Core Value Proposition**

The vision for this project is to create an intuitive, client-side web application that significantly simplifies the process of authoring PostgreSQL SQL queries. The traditional method of writing SQL, particularly for complex queries involving multiple joins, can be time-consuming and prone to errors, even for experienced developers and analysts. The application aims to alleviate this burden by offering a novel approach: schema-aware autocomplete that guides users through the intricate relationships within their database.

The core value proposition of this tool is its ability to allow users to "navigate" joins without explicitly writing SQL \[User Query\]. By simply pasting PostgreSQL Data Definition Language (DDL), the application constructs an in-memory representation of the database schema. Users can then type object-graph paths, such as orders.customer.name or orders.\*, and receive live, generated SELECT and LEFT JOIN SQL in real-time. This interactive experience accelerates query development, reduces syntax errors, and provides a "learnable output" in the form of raw, valid SQL, fostering a deeper understanding of the generated queries \[User Query\].

### **Scope Definition: MVP Goals and Constraints**

For the Minimum Viable Product (MVP), the project's scope is clearly defined to ensure focused development and timely delivery. The primary goals include:

* Accepting pasted PostgreSQL DDL as input.  
* Generating live PostgreSQL SQL statements, specifically SELECT and LEFT JOIN clauses.  
* Providing a robust, schema-aware autocomplete feature that assists users in navigating database relationships.

To maintain a lean and efficient MVP, several functionalities are explicitly excluded:

* No DDL mutation or write operations to the database.  
* No server-side backend components; the application will be 100% client-side.  
* No execution of the generated SQL queries.  
* No user authentication or authorization mechanisms.  
* Support is limited strictly to PostgreSQL dialects, with no plans for other SQL dialects in the MVP \[User Query\].

The project operates under several hard constraints:

* The application must be entirely client-side, hostable as static files, and built using Vite.  
* Input is exclusively pasted PostgreSQL DDL, including CREATE TABLE statements with foreign key definitions.  
* Output must be readable, valid PostgreSQL SQL, using only SELECT and LEFT JOIN clauses.  
* TypeScript is the preferred language for development, with React being an acceptable framework choice.  
* All dependencies must be small and reliable, minimizing the overall bundle size and ensuring a lightweight application \[User Query\].

### **Target User Profile: Empowering Developers and Analysts**

The primary users of this application are identified as "Developers/analysts who know their schema but want faster query authoring and learnable output (raw SQL)" \[User Query\]. This profile indicates a highly technical audience, including software engineers, data engineers, and senior data analysts. These users possess a strong understanding of database schemas and SQL concepts but seek tools to enhance their productivity and reduce the cognitive load associated with manual SQL composition, especially for complex join paths.

A critical aspect of the application's design is the emphasis on "learnable output (raw SQL)" \[User Query\]. This is not merely a technical requirement for valid SQL; it is a fundamental user experience objective. If the generated SQL, while syntactically correct, is difficult to read, inconsistent in its structure, or employs non-idiomatic patterns, the target user, who values transparency and control, will find it less useful. Such an outcome would undermine the "faster query authoring" value proposition. Therefore, the selection and configuration of the SQL formatting library, as well as the internal logic of the SQL generation algorithm, must prioritize clarity, consistent aliasing, and the generation of only necessary joins. For instance, the pretty option and keywordCase settings available in formatting libraries become essential functional requirements rather than optional styling choices.1 This commitment to readable and understandable SQL ensures that the output is genuinely valuable to a technical audience that seeks to accelerate their workflow while maintaining a clear understanding of the underlying query.

## **3\. Building Blocks Analysis & Recommendations**

### **3.1. PostgreSQL DDL Parsing & Schema Graph Construction**

The foundational challenge for this application is the accurate parsing of complex PostgreSQL DDL statements and their transformation into a structured, in-memory schema graph. This graph must precisely represent tables, columns, primary keys (PKs), and foreign key (FK) relationships, all within the constraints of a browser-safe environment.

#### **Candidate Libraries Comparison**

| Library Name | Key Features | Browser Compatibility | WASM/JS | Unpacked Bundle Size | License | Maturity/Activity |  |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| pgsql-parser ecosystem (libpg-query, pgsql-deparser, @pgsql/types, etc.) | High-fidelity AST from native C parser, symmetric parsing/deparsing, type-safe AST manipulation, battle-tested. | Explicitly supported (WASM), Pure TS deparser. | WASM (parser), Pure JS (deparser) | libpg-query: 1.25 MB 3, | pgsql-deparser: 950 kB 4 | MIT 3 | Production-grade, millions of downloads (libpg-query), active development (1.8k+ commits, recent activity) 4 |
| @supabase/pg-parser | Accurate AST from native C parser, multi-version Postgres support (15, 16, 17\) at runtime. | Designed for modern JS runtimes (Browser, Node.js, Deno, Bun) 8 | WASM | Not explicitly provided (expected similar to libpg-query) | Not explicitly provided | Community project, roadmap includes deparsing 8 |  |
| node-sql-parser | Supports multiple SQL statements, various databases (Postgres included), outputs table/column lists. | Unlikely (typically Node.js) | Pure JS | 91.8 MB 9 | Apache-2.0 9 | Active maintenance (recent commits) 9 |  |

#### **Recommended Solution & Rationale**

The pgsql-parser ecosystem is the optimal choice for PostgreSQL DDL parsing and schema graph construction.

Its primary advantage is its **unparalleled fidelity and accuracy**.5 By leveraging the actual PostgreSQL C parser compiled to WebAssembly (WASM),

libpg-query (the core component) guarantees a precise and complete Abstract Syntax Tree (AST) representation of even complex DDL, including detailed column definitions, PRIMARY KEY, FOREIGN KEY, and UNIQUE constraints.6 This level of accuracy is paramount for reliably building a schema graph that reflects the true structure and relationships of the database. The

@pgsql/types package further enhances this by providing comprehensive, type-safe definitions for AST nodes, including CreateStmt, ColumnDef, and Constraint types (e.g., CONSTR\_PRIMARY, CONSTR\_FOREIGN).12 This strong typing aligns perfectly with the project's preference for TypeScript and significantly improves the development and validation of schema graph extraction logic.

The ecosystem's **maturity and active maintenance** also instill confidence. libpg-query has millions of downloads and is trusted by numerous projects.6 The

pgsql-parser monorepo is described as "battle-tested against 23,000+ SQL statements" 5 and shows consistent recent activity, including commits and ongoing issue/pull request engagement.5 This indicates a robust and well-supported foundation for the application.

Furthermore, the choice of a WASM-based parser like libpg-query offers distinct advantages in terms of **performance and footprint** for a client-side application. While some JavaScript micro-benchmarks might show faster execution for very small functions, WASM provides predictable runtime performance and significantly faster loading, parsing, and compilation of larger codebases due to its compact binary format.13 For DDL parsing, which involves processing potentially large text inputs (hundreds of tables, thousands of lines of DDL), WASM's strengths in initial load time and scalable processing are directly beneficial. This ensures a more responsive user experience, particularly during the critical initial DDL processing phase.

Finally, the **permissive MIT license** associated with both libpg-query and pgsql-parser 3 makes them suitable for commercial use without restrictive obligations.

While @supabase/pg-parser is a strong alternative, also leveraging WASM for parsing and offering multi-version support 8, the

launchql monorepo (pgsql-parser family) provides a more complete suite of integrated tools for AST manipulation and deparsing. node-sql-parser was considered but deemed unsuitable due to its exceptionally large unpacked bundle size of 91.8 MB 9, which violates the "small, reliable dependencies" constraint for a client-side web application \[User Query\].

### **3.2. Interactive Editor & Schema-Aware Autocomplete**

The interactive core of the application relies on a robust text editor capable of providing highly context-aware autocomplete suggestions. These suggestions must be dynamically generated from the parsed schema graph, necessitating deep integration with the editor's completion provider API and sophisticated logic for traversing relational paths.

#### **Candidate Libraries Comparison**

| Library Name | Key Features | Customization for Autocomplete | Browser Compatibility | Unpacked Bundle Size | License | Maturity/Activity |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| Monaco Editor | VS Code's editor, IntelliSense, syntax highlighting, validation. | CompletionItemProvider interface with provideCompletionItems and resolveCompletionItem methods.15 | Desktop browsers (Edge, Chrome, Firefox, Safari, Opera); **No mobile support**.17 | \~15 MB (with optimizations, can be split into \~7.5 MB bundles).18 A wrapper reports 114.5 kB.19 | MIT 20 | Highly mature, foundation of VS Code, actively maintained by Microsoft.17 |
| CodeMirror 6 | Modern, extensible, TypeScript-rewritten, tree-shaking friendly. | @codemirror/autocomplete package, CompletionContext for dynamic/async suggestions, matchBefore for context, boost for ranking.22 | Universal (browsers, Node.js, Deno, Bun); improved accessibility, bidi-capable, touchscreen-friendly.22 | Core: 21.3 kB.24 Minimal setup: \~50 kB.25 Full setup with extensions: \~850 kB.25 | MIT / GPL-v3 Dual License 26 | Actively developed (v6 released 2022), frequent bug fixes and new features.23 |

#### **Recommended Solution & Autocomplete Strategy**

CodeMirror 6 is the recommended solution for the interactive editor and schema-aware autocomplete functionality.

CodeMirror 6's **significantly smaller core bundle size** (21.3 kB unpacked for the core codemirror package compared to Monaco's approximate 15 MB) 18 provides a decisive advantage for a 100% client-side, static Vite build. This directly addresses the "small, reliable dependencies" and "Performance and footprint" hard constraints \[User Query\], leading to faster initial load times and a more responsive application. Its modular design, which leverages "tree-shaking-friendly ES modules" 23, allows for precise control over the final bundle, including only the necessary extensions. This contrasts with Monaco Editor, which, despite optimization efforts, still presents a substantial initial download.

The editor's design for **extensibility and its TypeScript-first approach** are also key strengths. CodeMirror 6 offers a clear and well-documented API for custom completion sources via the @codemirror/autocomplete package.22 Its

CompletionContext provides crucial information about the editor's state and cursor position, enabling highly dynamic and context-aware suggestions. The explicit support for asynchronous completion sources, where functions can return Promises 22, is vital for fetching and processing schema data in real-time without blocking the UI. This capability allows the autocomplete provider to query the in-memory schema graph, perform complex path resolution, and then present relevant suggestions efficiently. Methods like

matchBefore further aid in precisely identifying the text segment preceding the cursor, which is essential for guiding suggestions along object-graph paths.22

CodeMirror 6 also boasts **universal browser compatibility**, including improved accessibility and touchscreen friendliness.23 This ensures a broader reach and a consistent user experience across various devices, unlike Monaco Editor's explicit lack of mobile support.17 The active development and frequent updates of CodeMirror 6 29 further contribute to its long-term viability and reliability.

The autocomplete strategy will involve implementing a custom completion source for CodeMirror 6\. This source will:

1. **Identify Context:** Use context.matchBefore to determine the current input prefix and the type of object being typed (e.g., table name, column name, or a relationship path segment).22  
2. **Query Schema Graph:** Based on the context, query the in-memory schema graph to retrieve relevant tables, columns, or foreign key relationships.  
3. **Generate Suggestions:** Construct CompletionItem objects with label (the suggestion text), type (e.g., "table", "column", "relationship"), and potentially info or detail for additional context.22 For path navigation, suggestions will dynamically appear as the user types, guiding them through available relationships (e.g.,  
   orders., then customer., then name).  
4. **Handle Disambiguation:** When multiple foreign keys point to the same table (e.g., orders.billing\_customer\_id and orders.shipping\_customer\_id both referencing customers), the completion provider will need to offer a mechanism for disambiguation, potentially through explicit suffix tokens (e.g., orders.customer(billing).name) or a chooser UI.31  
5. **Ranking:** Utilize the boost property of CompletionItem to influence the ranking of suggestions, prioritizing more relevant or frequently used paths.22

### **3.3. SQL Generation & Formatting**

The final stage of the application's core functionality involves accurately translating the user's object-graph path into valid PostgreSQL SELECT and LEFT JOIN statements and presenting this SQL in a readable, consistently formatted manner.

#### **Candidate Libraries Comparison**

| Library Name | Key Features | Browser Compatibility | PostgreSQL Support | Unpacked Bundle Size | License | Maturity/Activity |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| sql-formatter | Pretty-prints SQL, extensive formatting options (indentation, keyword case, line breaks), placeholder replacement. | Widely supported (modern browsers); dist files for non-bundler use.1 | Explicitly supports PostgreSQL.1 | 2.73 MB 1 | MIT 1 | Active maintenance (recent commits, releases), battle-tested.1 |
| pgsql-deparser | Lightning-fast AST-to-SQL conversion, pure TypeScript, zero WASM overhead for deparsing, battle-tested. | Universal (browsers, Node.js, edge functions).4 | Direct AST conversion from Postgres parser.4 | 950 kB 4 | SEE LICENSE IN LICENSE (part of launchql/pgsql-parser monorepo, which is MIT) 4 | Battle-tested (23,000+ SQL statements), active development.4 |
| Online Formatters (sqlformat.org, site24x7.com) | Web-based SQL formatting, privacy-focused (in-browser processing). | Browser-based | sqlformat.org uses sqlparse (Python via Pyodide) for various dialects including Postgres.2 | N/A (service, not library) | N/A | N/A |

#### **Recommended Solution & Formatting Approach**

The recommended approach for SQL generation and formatting involves a combination of pgsql-deparser for accurate AST-to-SQL conversion and sql-formatter for advanced pretty-printing and stylistic consistency.

pgsql-deparser is highly recommended for the core AST-to-SQL conversion. As part of the pgsql-parser ecosystem, it offers a "lightning-fast, pure TypeScript solution for converting PostgreSQL ASTs back into SQL queries".4 Its "battle-tested reliability" against over 23,000 SQL statements 4 ensures that the generated SQL is syntactically correct and faithful to the PostgreSQL specification. Being pure TypeScript, it avoids WebAssembly overhead for deparsing, ensuring universal compatibility across JavaScript environments and contributing to a smaller overall footprint.4 This tight integration with the chosen DDL parser (

pgsql-parser) guarantees seamless compatibility between the parsed schema representation and the SQL generation process.

Following the initial SQL generation by pgsql-deparser, sql-formatter will be utilized for post-processing and fine-grained pretty-printing. sql-formatter explicitly supports PostgreSQL and offers a wide array of configuration options, including tabWidth, keywordCase (e.g., 'upper' for keywords), and linesBetweenQueries.1 Its ability to "pretty" format with indentation and line breaks 4 is crucial for the "learnable output (raw SQL)" requirement \[User Query\]. The unpacked bundle size of

sql-formatter is 2.73 MB 1, which, while not as small as

pgsql-deparser, is manageable for a client-side application, especially given its comprehensive formatting capabilities. The library is actively maintained, with recent commits and releases 35, and is distributed under the permissive MIT license.1

This dual-library approach leverages the strengths of each: pgsql-deparser for precise and efficient AST reconstruction into raw SQL, and sql-formatter for transforming that raw SQL into a highly readable, consistently styled format. The emphasis on "learnable output" means that the generated SQL must not only be valid but also aesthetically pleasing and structured in a way that is easily digestible by developers and analysts. Options like pretty: true and keywordCase: 'upper' in sql-formatter are not mere stylistic preferences but critical features that directly contribute to the tool's core value by making the output transparent and understandable.1 This ensures that users can inspect, learn from, and trust the automatically generated queries, fulfilling the implicit need for transparent and comprehensible output.

## **4\. Architectural Design for the MVP**

The proposed architecture for the MVP is designed to be entirely client-side, modular, and to facilitate a clear flow of state and data between components. This design prioritizes responsiveness, maintainability, and adherence to the hard constraints of the project.

### **Proposed Architecture 1 (Component Diagram, Detailed State Flow)**

The application will be structured around several key components, each responsible for a specific part of the user interaction and data transformation pipeline.

#### **Component Diagram**

Code snippet

graph TD  
    A \--\> B{DDL Parser};  
    B \--\> C{Schema Graph Builder};  
    C \--\> D;  
    D \--\> E\[Path Input Editor (CodeMirror)\];  
    E \-- Autocomplete Request \--\> F{Autocomplete Provider};  
    F \-- Schema Query \--\> D;  
    F \-- Suggestions \--\> E;  
    E \-- Path Input Change \--\> G{Path Resolver};  
    G \-- Join Plan \--\> H{SQL Emitter};  
    H \-- Raw SQL \--\> I{SQL Formatter};  
    I \-- Formatted SQL \--\> J;

#### **Detailed State Flow**

The application's state and data flow through a well-defined pipeline, ensuring real-time responsiveness and clear separation of concerns:

1. **DDL Input and Parsing:**  
   * The user pastes PostgreSQL DDL statements into the **DDL Input Area**. This area is a simple text input component.  
   * Upon a change in the DDL input (e.g., debounced onChange event), the **DDL Parser** component (utilizing pgsql-parser 5) processes the DDL string. This parsing operation generates an Abstract Syntax Tree (AST) representation of the database schema. Error handling for invalid DDL will be integrated here, providing immediate feedback to the user.  
2. **Schema Graph Construction:**  
   * The AST output from the DDL Parser is then fed into the **Schema Graph Builder** (a custom module). This builder traverses the AST, specifically identifying CreateStmt nodes.8  
   * For each CreateStmt, it extracts table names, column definitions (including data types and NOT NULL constraints), primary key information (including composite keys), and foreign key relationships (referencing table, referenced columns, and referenced table).8  
   * This extracted information is then used to construct an in-memory, interconnected **Schema Graph**. This graph will logically represent tables as nodes and foreign keys as directed edges, facilitating efficient traversal for join path resolution.  
3. **Schema Graph Storage:**  
   * The constructed Schema Graph is stored in a centralized, client-side **Schema Graph Store**. This store will act as the single source of truth for the database schema within the application. Given the client-side nature, a lightweight state management solution (e.g., React Context, Zustand, or a simple global object for MVP) would be appropriate. Updates to this store will trigger re-renders of dependent UI components.  
4. **Path Input and Autocomplete:**  
   * The user interacts with the **Path Input Editor** (implemented using CodeMirror 6 22), typing object-graph paths (e.g.,  
     orders.customer.name).  
   * As the user types, CodeMirror's **Autocomplete Provider** (a custom implementation leveraging CodeMirror's CompletionItemProvider API 22) is triggered.  
   * The Autocomplete Provider queries the **Schema Graph Store** to retrieve relevant schema information based on the current cursor position and the partial path typed. For example, if the user types orders., the provider will look up foreign keys from the orders table and suggest related table names or columns from the orders table itself.  
   * The Autocomplete Provider generates a list of suggestions and sends them back to the Path Input Editor, which displays them to the user. This process is asynchronous to ensure a smooth user experience.22  
5. **Path Resolution and SQL Generation:**  
   * When the user's object-graph path input changes (e.g., after selecting an autocomplete suggestion or typing a full path), the **Path Resolver** (a custom algorithm) is invoked.  
   * The Path Resolver interprets the object-graph path against the Schema Graph. It performs a graph traversal (e.g., a Breadth-First Search for shortest paths 37) to determine the necessary sequence of  
     LEFT JOIN operations required to connect the tables implied by the path. This process builds an internal JoinPlan, which includes the ordered list of tables to join, their aliases, and the ON conditions based on foreign key relationships. It also identifies the final selectedColumns for the SELECT clause.  
   * The JoinPlan is then passed to the **SQL Emitter** (another custom module). This component constructs the raw PostgreSQL SELECT statement and the sequence of LEFT JOIN clauses, applying consistent aliasing (e.g., t0, t1, t2 39) and correct identifier quoting.  
6. **SQL Formatting and Display:**  
   * The raw SQL string from the SQL Emitter is sent to the **SQL Formatter**. This component uses pgsql-deparser for initial AST-to-SQL conversion (if the SQL Emitter builds an AST) and sql-formatter for pretty-printing and applying stylistic rules (e.g., keywordCase: 'upper', indentation).1  
   * The final, formatted SQL is then displayed in the **SQL Output Display** area, providing the user with immediate, readable feedback.

### **Justification for the Selected Approach**

This architectural design is chosen for several compelling reasons:

* **100% Client-Side Adherence:** Every component and data flow is designed to operate entirely within the user's browser, meeting the hard constraint of a static, Vite-built application \[User Query\].  
* **Modularity and Separation of Concerns:** Each component has a distinct responsibility (parsing, graph building, editing, path resolution, SQL generation, formatting). This modularity enhances maintainability, testability, and allows for independent development and optimization of each part.  
* **Leveraging Specialized Libraries:** The architecture strategically integrates best-in-class, battle-tested libraries for specific tasks (e.g., pgsql-parser for DDL parsing, CodeMirror 6 for editing, sql-formatter for formatting). This reduces custom development effort for complex functionalities where robust open-source solutions exist.  
* **Performance and Responsiveness:** By using WASM-based parsing 6 and a lightweight editor 24, coupled with efficient in-memory data structures for the schema graph and debounced input handling, the application is designed for real-time responsiveness, even with moderately large schemas.  
* **TypeScript Preference:** The use of TypeScript throughout the custom components and the selection of libraries with strong TypeScript support (e.g., CodeMirror 6, pgsql-parser ecosystem with @pgsql/types 12) ensures type safety, improves code quality, and facilitates easier refactoring and collaboration.  
* **Clear State Management:** The Schema Graph Store acts as a centralized, reactive data source, ensuring that changes to the DDL or user input propagate efficiently through the system to update the generated SQL.

## **5\. Core Algorithm Design (Pseudocode)**

### **Algorithm for Building the Foreign Key Graph from DDL AST**

This algorithm processes the Abstract Syntax Tree (AST) generated from PostgreSQL DDL to construct an in-memory representation of the database schema, focusing on tables, columns, primary keys, and foreign keys. The AST structure is expected to align with libpg-query's output, as exposed by pgsql-parser and typed by @pgsql/types.

Code snippet

Function buildForeignKeyGraph(ddlAst: PostgresAST): SchemaGraph  
    Input:  
        ddlAst: An object representing the parsed AST of the PostgreSQL DDL.  
                Expected to contain an array of statements, where each statement  
                can be a CreateStmt for table definitions.  
    Output:  
        SchemaGraph: A map where keys are table names (string) and values are  
                     TableInfo objects.

    Define TableInfo:  
        TableInfo {  
            tableName: string,  
            columns: Map\<string, ColumnInfo\>, // Map\<columnName, ColumnInfo\>  
            primaryKeys: string, // Array of column names forming the PK  
            foreignKeys: ForeignKeyInfo // Array of ForeignKeyInfo objects  
        }

    Define ColumnInfo:  
        ColumnInfo {  
            columnName: string,  
            dataType: string,  
            isNotNull: boolean  
        }

    Define ForeignKeyInfo:  
        ForeignKeyInfo {  
            constraintName: string, // Optional, if provided in DDL  
            localColumns: string, // Columns in the current table  
            referencedTable: string,  
            referencedColumns: string // Columns in the referenced table  
        }

    Initialize schemaGraph \= new Map\<string, TableInfo\>()

    For each stmt in ddlAst.stmts:  
        If stmt is of type RawStmt and contains a CreateStmt:  
            Let createStmt \= stmt.RawStmt.stmt.CreateStmt

            Let tableName \= createStmt.relation.relname.toLowerCase() // Normalize table name  
            Initialize currentTableInfo \= new TableInfo(tableName, new Map(),,)

            For each tableElt in createStmt.tableElts:  
                If tableElt is of type ColumnDef:  
                    Let colName \= tableElt.colname.toLowerCase() // Normalize column name  
                    Let dataType \= tableElt.typeName.names.String.str.toLowerCase() // Extract data type  
                    Let isNotNull \= false  
                    For each constraint in tableElt.constraints:  
                        If constraint.Constraint.contype \== CONSTR\_NOTNULL:  
                            isNotNull \= true  
                    currentTableInfo.columns.set(colName, { columnName: colName, dataType: dataType, isNotNull: isNotNull })

                Else if tableElt is of type Constraint:  
                    Let constraintType \= tableElt.Constraint.contype  
                    Let constraintName \= tableElt.Constraint.conname // May be null

                    If constraintType \== CONSTR\_PRIMARY:  
                        // Handle column-level or table-level primary key  
                        If tableElt.Constraint.keys: // Table-level PK  
                            For each key in tableElt.Constraint.keys:  
                                currentTableInfo.primaryKeys.push(key.ColumnRef.fields.String.str.toLowerCase())  
                        Else if tableElt.Constraint.location: // Column-level PK (already handled in ColumnDef, but double-check)  
                            // This case is less common for explicit PK constraints, usually handled by ColumnDef.constraints  
                            // Ensure the column is marked as PK if not already.  
                            // For simplicity, assume table-level PK or it's handled by ColumnDef.  
                            // The @pgsql/types definition shows CONSTR\_PRIMARY within ColumnDef.constraints or as a top-level Constraint.  
                            // For a column-level PK, the ColumnDef.constraints would contain { Constraint: { contype: 'CONSTR\_PRIMARY' } }  
                            // For a table-level PK, it would be a separate Constraint element in tableElts with keys.  
                            // The provided @pgsql/types example confirms this structure.\[12\]  
                            If tableElt.Constraint.keys: // Table-level PK  
                                For each key in tableElt.Constraint.keys:  
                                    currentTableInfo.primaryKeys.push(key.ColumnRef.fields.String.str.toLowerCase())

                    Else if constraintType \== CONSTR\_FOREIGN:  
                        Let localCols \=  
                        For each key in tableElt.Constraint.fk\_attrs:  
                            localCols.push(key.ColumnRef.fields.String.str.toLowerCase())

                        Let referencedTable \= tableElt.Constraint.pktable.relname.toLowerCase()  
                        Let referencedCols \=  
                        For each key in tableElt.Constraint.pk\_attrs:  
                            referencedCols.push(key.ColumnRef.fields.String.str.toLowerCase())

                        currentTableInfo.foreignKeys.push({  
                            constraintName: constraintName,  
                            localColumns: localCols,  
                            referencedTable: referencedTable,  
                            referencedColumns: referencedCols  
                        })

            schemaGraph.set(tableName, currentTableInfo)

    Return schemaGraph

Elaboration on DDL Parsing Complexity:  
Parsing DDL statements, particularly CREATE TABLE, involves extracting a rich set of information beyond just table and column names. It requires understanding various constraint types, including NOT NULL, UNIQUE, PRIMARY KEY, and FOREIGN KEY.10 Primary keys can be defined at the column level or as table-level constraints, and they can be composite (spanning multiple columns).10 Similarly, foreign keys also involve specifying local columns, the referenced table, and the specific columns in the referenced table that form the link.42 The  
pgsql-parser library, with its underlying libpg-query and comprehensive @pgsql/types definitions, is crucial for this task.6 It provides a detailed Abstract Syntax Tree (AST) where these distinct elements and their relationships are explicitly represented, allowing the

SchemaGraphBuilder to accurately identify and store composite keys and multi-column foreign key references. This granular AST representation is essential for the subsequent steps of path resolution and SQL generation, as it ensures that the tool has a complete and correct understanding of the database's relational structure.

### **Algorithm for Resolving Object-Graph Paths to a JOIN Plan**

This algorithm takes a user-provided object-graph path (e.g., orders.customer.name) and resolves it into a sequence of LEFT JOIN operations and selected columns, leveraging the pre-built SchemaGraph.

Code snippet

Function resolvePathToJoinPlan(schemaGraph: SchemaGraph, objectPath: string): JoinPlan  
    Input:  
        schemaGraph: The in-memory representation of the database schema.  
        objectPath: A string representing the object-graph path (e.g., "orders.customer.name", "products.\*").  
    Output:  
        JoinPlan: An object containing:  
            initialTable: string, // The starting table for the FROM clause  
            joins: JoinStep,    // Ordered list of necessary LEFT JOINs  
            selectedColumns: SelectedColumn // List of columns to select

    Define JoinStep:  
        JoinStep {  
            sourceTable: string,  
            targetTable: string,  
            localColumns: string,  
            referencedColumns: string,  
            alias: string // Alias for the targetTable in the join  
        }

    Define SelectedColumn:  
        SelectedColumn {  
            tableAlias: string,  
            columnName: string  
        }

    Initialize joinPlan \= { initialTable: "", joins:, selectedColumns: }  
    Initialize currentTable \= ""  
    Initialize tableAliases \= new Map\<string, string\>() // Map\<tableName, alias\>  
    Initialize aliasCounter \= 0  
    Initialize visitedTablesForPath \= new Set\<string\>() // To prevent cycles during path traversal

    Let pathSegments \= objectPath.split('.')  
    If pathSegments is empty: Return empty JoinPlan

    // Determine initial table  
    currentTable \= pathSegments.toLowerCase()  
    If not schemaGraph.has(currentTable): Throw Error("Initial table not found in schema.")  
    joinPlan.initialTable \= currentTable  
    tableAliases.set(currentTable, \`t${aliasCounter++}\`)  
    visitedTablesForPath.add(currentTable)

    For i from 1 to pathSegments.length \- 1:  
        Let segment \= pathSegments\[i\].toLowerCase()

        If segment \== "\*":  
            // Select all columns from the current table  
            Let currentTableInfo \= schemaGraph.get(currentTable)  
            For each colName in currentTableInfo.columns.keys():  
                joinPlan.selectedColumns.push({  
                    tableAlias: tableAliases.get(currentTable),  
                    columnName: colName  
                })  
            Continue // Move to next segment

        // Check if segment is a column of the current table  
        Let currentTableInfo \= schemaGraph.get(currentTable)  
        If currentTableInfo.columns.has(segment):  
            joinPlan.selectedColumns.push({  
                tableAlias: tableAliases.get(currentTable),  
                columnName: segment  
            })  
            Continue // Move to next segment

        // If not a column, assume it's a table to join to  
        Let targetTable \= segment  
        If not schemaGraph.has(targetTable): Throw Error(\`Table '${targetTable}' not found in schema.\`)

        // Find shortest path of FKs from currentTable to targetTable  
        // This is a Breadth-First Search (BFS) on the schema graph  
        Let queue \= }\] // path: array of ForeignKeyInfo  
        Let visited \= new Set\<string\>()  
        visited.add(currentTable)  
        Let foundPath \= null

        While queue is not empty:  
            Let { table: currentSearchTable, path: currentSearchPath } \= queue.shift()

            If currentSearchTable \== targetTable:  
                foundPath \= currentSearchPath  
                Break

            Let searchTableInfo \= schemaGraph.get(currentSearchTable)  
            For each fk of searchTableInfo.foreignKeys:  
                If not visited.has(fk.referencedTable):  
                    visited.add(fk.referencedTable)  
                    queue.push({ table: fk.referencedTable, path: })

        If not foundPath: Throw Error(\`No direct or indirect foreign key path found from '${currentTable}' to '${targetTable}'.\`)

        // Add joins for the found path  
        For each fkStep in foundPath:  
            If not visitedTablesForPath.has(fkStep.referencedTable): // Deduplicate joins  
                Let newAlias \= \`t${aliasCounter++}\`  
                tableAliases.set(fkStep.referencedTable, newAlias)  
                joinPlan.joins.push({  
                    sourceTable: fkStep.localColumns.length \> 0? fkStep.localColumns : "", // Placeholder, actual logic uses source table alias  
                    targetTable: fkStep.referencedTable,  
                    localColumns: fkStep.localColumns,  
                    referencedColumns: fkStep.referencedColumns,  
                    alias: newAlias  
                })  
                visitedTablesForPath.add(fkStep.referencedTable)  
          
        currentTable \= targetTable // Update current table for next segment

    // Final deduplication of joins:  
    // After initial path resolution, iterate through joinPlan.joins.  
    // Ensure that for any two tables A and B, there is only one join path.  
    // If multiple paths exist (e.g., due to different FKs or indirect paths),  
    // prioritize the shortest path or a predefined "preferred" path.  
    // For MVP, the BFS already finds a shortest path.  
    // The \`visitedTablesForPath\` set helps prevent adding redundant joins if a table is already part of the path.  
    // Additional deduplication might involve checking if a join's target table is already reachable via an \*earlier\* join in the \`joinPlan.joins\` list.  
    // This ensures that the generated SQL has a minimal set of necessary joins.\[44, 45, 46\]

    Return joinPlan

Elaboration on Join Path Generation:  
The process of resolving an object-graph path into a sequence of SQL LEFT JOINs is fundamentally a graph traversal problem. The SchemaGraph, with tables as nodes and foreign key relationships as edges, serves as the graph. A Breadth-First Search (BFS) algorithm is particularly well-suited for finding the shortest path (in terms of number of joins) between two tables in an unweighted graph, where each join represents a single "hop".37 This ensures that the generated SQL is as concise as possible, avoiding unnecessary intermediate joins.  
A critical aspect of this resolution is handling potential ambiguities. For instance, a table like orders might have multiple foreign keys referencing the customers table, such as billing\_customer\_id and shipping\_customer\_id.31 If a user simply types

orders.customer.name, the system faces an ambiguity. To address this, the algorithm must implement a disambiguation strategy. This could involve:

1. **Explicit Suffix Tokens:** Requiring the user to specify which foreign key to follow, e.g., orders.customer(billing).name or orders.customer(shipping).name.  
2. **Chooser UI:** Presenting a small pop-up or inline UI element that allows the user to select the desired foreign key when ambiguity is detected.32  
3. **Default/Heuristic:** Applying a default rule, such as picking the first foreign key encountered or one with a common name pattern, though this might not always align with user intent. For the MVP, explicit paths or a simple chooser UI would be robust.

Furthermore, the algorithm must account for cycles in the foreign key graph (e.g., employees \-\> departments \-\> managers \-\> employees). The visitedTablesForPath set is crucial for preventing infinite loops during graph traversal and ensuring that each table is joined only once along the selected path, thus "deduplicating" joins.44 This ensures that the generated SQL is clean and efficient, avoiding redundant join clauses that would complicate the query and potentially impact performance.

### **Algorithm for Emitting SQL with Deduped LEFT JOINs and Consistent Aliases**

This algorithm takes the JoinPlan (resolved from the object-graph path) and constructs a complete, formatted PostgreSQL SELECT statement with LEFT JOIN clauses.

Code snippet

Function emitSQL(joinPlan: JoinPlan): string  
    Input:  
        joinPlan: An object containing initialTable, joins (ordered list of JoinStep), and selectedColumns.  
    Output:  
        sqlString: A formatted PostgreSQL SELECT statement.

    // 1\. Generate SELECT clause  
    Let selectColumns \=  
    If joinPlan.selectedColumns is empty:  
        // Default to selecting all columns from the initial table if no specific columns are requested  
        Let initialTableAlias \= tableAliases.get(joinPlan.initialTable) // Assuming tableAliases from resolvePathToJoinPlan is accessible  
        selectColumns.push(\`${quoteIdentifier(initialTableAlias)}.\*\`)  
    Else:  
        For each col in joinPlan.selectedColumns:  
            selectColumns.push(\`${quoteIdentifier(col.tableAlias)}.${quoteIdentifier(col.columnName)}\`)

    Let selectClause \= \`SELECT ${selectColumns.join(', ')}\`

    // 2\. Generate FROM clause  
    Let initialTableAlias \= tableAliases.get(joinPlan.initialTable)  
    Let fromClause \= \`FROM ${quoteIdentifier(joinPlan.initialTable)} AS ${quoteIdentifier(initialTableAlias)}\`

    // 3\. Generate LEFT JOIN clauses  
    Let joinClauses \=  
    For each joinStep in joinPlan.joins:  
        Let sourceTableAlias \= tableAliases.get(joinStep.sourceTable) // Get alias of the table from which FK originates  
        Let targetTableAlias \= joinStep.alias

        If joinStep.localColumns.length \== 1 and joinStep.referencedColumns.length \== 1:  
            // Simple single-column FK  
            Let localCol \= quoteIdentifier(joinStep.localColumns)  
            Let referencedCol \= quoteIdentifier(joinStep.referencedColumns)  
            joinClauses.push(  
                \`LEFT JOIN ${quoteIdentifier(joinStep.targetTable)} AS ${quoteIdentifier(targetTableAlias)} \` \+  
                \`ON ${quoteIdentifier(sourceTableAlias)}.${localCol} \= ${quoteIdentifier(targetTableAlias)}.${referencedCol}\`  
            )  
        Else if joinStep.localColumns.length \> 1 and joinStep.localColumns.length \== joinStep.referencedColumns.length:  
            // Composite FK  
            Let onConditions \=  
            For k from 0 to joinStep.localColumns.length \- 1:  
                Let localCol \= quoteIdentifier(joinStep.localColumns\[k\])  
                Let referencedCol \= quoteIdentifier(joinStep.referencedColumns\[k\])  
                onConditions.push(\`${quoteIdentifier(sourceTableAlias)}.${localCol} \= ${quoteIdentifier(targetTableAlias)}.${referencedCol}\`)  
            joinClauses.push(  
                \`LEFT JOIN ${quoteIdentifier(joinStep.targetTable)} AS ${quoteIdentifier(targetTableAlias)} \` \+  
                \`ON (${onConditions.join(' AND ')})\`  
            )  
        Else:  
            // Handle error or unexpected FK structure  
            Throw Error("Unsupported foreign key structure for join generation.")

    // 4\. Combine all clauses  
    Let rawSQL \= \`${selectClause}\\n${fromClause}\`  
    If joinClauses.length \> 0:  
        rawSQL \+= \`\\n${joinClauses.join('\\n')}\`

    // 5\. Apply SQL formatting  
    // Use sql-formatter with PostgreSQL dialect and pretty-printing options  
    Let formattedSQL \= format(rawSQL, {  
        language: 'postgresql',  
        pretty: true,  
        newline: '\\n',  
        tab: '  ', // 2 spaces for indentation  
        keywordCase: 'upper', // Keywords in uppercase for readability \[1, 2\]  
        semicolons: true // Add semicolon at the end  
    })

    Return formattedSQL

// Helper function for identifier quoting  
Function quoteIdentifier(identifier: string): string  
    // PostgreSQL quoting rules: identifiers are lowercased by default unless quoted.  
    // Quote if identifier contains special characters, is case-sensitive, or is a reserved keyword.  
    // For simplicity, always quote to ensure consistency and handle all cases.  
    Return \`"${identifier}"\`

Elaboration on SQL Generation:  
The SQL generation algorithm is designed to produce "readable, valid Postgres SQL using SELECT and LEFT JOIN only" \[User Query\]. This requires careful attention to several details:

1. **Consistent Aliasing:** Each table involved in a join is assigned a unique, short alias (e.g., t0, t1, t2). This significantly improves the readability of the generated query, especially when joining multiple tables or performing self-joins where distinguishing between instances of the same table is crucial.39 The alias strategy ensures that column references are always qualified (e.g.,  
   t0.column\_name), preventing ambiguity.  
2. **Correct ON Clause Construction:** The ON clause for each LEFT JOIN is dynamically built using the foreign key information (local and referenced columns) extracted during schema graph construction. This includes correctly handling composite foreign keys, where multiple columns form the join condition, by combining them with AND operators within parentheses.33  
3. **Identifier Quoting:** PostgreSQL has specific rules for identifiers. By default, unquoted identifiers are folded to lowercase. If a table or column name contains special characters, spaces, or is case-sensitive (e.g., MyTable), it must be double-quoted ("MyTable") to be correctly interpreted. The quoteIdentifier helper function ensures that all table and column names in the generated SQL are properly quoted, guaranteeing validity and preventing issues with unusual naming conventions.11  
4. **Formatting for Readability:** The final step involves applying a robust SQL formatter. The sql-formatter library is chosen for this purpose due to its explicit support for PostgreSQL and its comprehensive formatting options.1 Configuring it to  
   pretty: true, use consistent indentation (tab: ' '), and enforce keywordCase: 'upper' directly contributes to the "learnable output" requirement.1 This ensures that the generated SQL is not just functional but also aesthetically pleasing and easy for a human to read, debug, and understand, thereby enhancing the overall utility of the tool for its target audience of developers and analysts.

## **6\. Risk Register & Mitigation Strategies**

This section identifies potential risks associated with the development and deployment of the client-side schema-aware SQL builder, along with proposed mitigation strategies.

| Risk | Description | Impact | Mitigation Strategy |  |  |  |  |
| :---- | :---- | :---- | :---- | :---- | :---- | :---- | :---- |
| **Composite Foreign Keys** | DDL may contain foreign keys composed of multiple columns. | Incorrect schema graph representation; faulty join conditions in generated SQL. | The pgsql-parser and @pgsql/types provide structured AST nodes for Constraint and ForeignKeyInfo, allowing accurate extraction of all columns involved in a composite key.12 The | buildForeignKeyGraph algorithm will explicitly parse and store all localColumns and referencedColumns for each FK. The emitSQL algorithm will generate ON clauses with multiple AND conditions for composite keys.33 |  |  |  |
| **Missing Primary Keys** | Tables in the DDL might not have an explicit PRIMARY KEY constraint, relying on UNIQUE constraints or no unique identifier. | Join path resolution may struggle to identify clear unique columns for ON clauses; potential for non-unique joins or ambiguity. | During schema graph construction, prioritize explicit PRIMARY KEY constraints. If a table lacks a PK, check for UNIQUE constraints that could serve as join targets. If neither is present, the system will either: 1\) warn the user about potential ambiguity for joins involving this table, or 2\) require manual specification of join columns via the path input or a disambiguation UI. |  |  |  |  |
| **Ambiguous Relations** | Multiple foreign keys exist between the same two tables (e.g., orders.billing\_customer\_id and orders.shipping\_customer\_id both reference customers.id). | Autocomplete suggestions become ambiguous; automatic join path generation may pick an unintended relationship. | Implement disambiguation mechanisms: 1\. **Suffix Tokens:** Allow users to specify the relationship in the path (e.g., orders.customer(billing).name). 2\. **Chooser UI:** When ambiguity is detected by the autocomplete provider, present a small inline UI element or dropdown allowing the user to select the desired foreign key relationship.31 | 3\. **Default Heuristic:** For MVP, a simple heuristic (e.g., alphabetical order of FK names) could be a fallback, but user choice is preferred. |  |  |  |
| **Cycles in FK Graph** | Circular dependencies in foreign key relationships (e.g., A \-\> B \-\> C \-\> A). | Infinite loops during path traversal; complex or incorrect join paths. | The resolvePathToJoinPlan algorithm will use a visitedTablesForPath set during graph traversal (BFS) to detect and prevent revisiting tables already part of the current path.37 This ensures that generated join paths are acyclic and minimal, avoiding redundant joins and infinite loops.38 |  |  |  |  |
| **Unusual Quoting & Schema-Qualified Names** | PostgreSQL allows identifiers with special characters or case-sensitivity to be double-quoted ("MyTable"), and objects can be schema-qualified (myschema.mytable). | Parser errors; incorrect SQL generation if quoting rules are not followed. | The pgsql-parser is built from the native PostgreSQL C parser, ensuring it correctly handles various quoting conventions and schema-qualified names during DDL parsing.6 The | emitSQL algorithm will consistently apply double-quoting to all table and column identifiers (quoteIdentifier function) to prevent issues with case-sensitivity or special characters, ensuring the generated SQL is always valid and robust.39 |  |  |  |
| **Performance on Large Schemas** | DDL parsing speed, autocomplete responsiveness, and SQL generation time on schemas with hundreds of tables and thousands of columns. | Sluggish user experience; application freezing. | **DDL Parsing:** Leverage libpg-query's WASM compilation for faster parsing.6 | **Schema Graph:** Use efficient in-memory data structures (e.g., Maps for quick lookups, adjacency lists for relationships). **Autocomplete:** Implement debouncing for user input to avoid excessive computation.48 The | CompletionContext in CodeMirror allows for efficient, context-aware suggestions.22 | **SQL Generation:** Optimize graph traversal (BFS is efficient for shortest paths in unweighted graphs, O(V+E) 37). Memoize or cache results of | resolvePathToJoinPlan for frequently accessed paths. |
| **Bundle Size** | Large dependencies (e.g., Monaco Editor, node-sql-parser) can lead to significant initial download times for a client-side application. | Slow initial load; poor user experience. | Select lightweight core libraries: CodeMirror 6 (21.3 kB core) over Monaco Editor (\~15 MB).18 Utilize Vite's tree-shaking capabilities to remove unused code. Employ dynamic imports for less frequently used components or large language-specific extensions to load them on demand, reducing the initial bundle size. |  |  |  |  |

## **7\. Minimal Proof-of-Concept (PoC) Plan**

A minimal Proof-of-Concept (PoC) can be developed within 2-3 days of focused effort to validate the core technical feasibility of the proposed architecture and algorithms.

### **Key Development Tasks**

1. **Day 1: DDL Parsing & Basic Schema Graph (1 day)**  
   * **Task 1.1:** Set up a basic Vite React project with TypeScript.  
   * **Task 1.2:** Integrate pgsql-parser into the project. Create a simple input area for pasting DDL.  
   * **Task 1.3:** Implement the core buildForeignKeyGraph function. For the PoC, focus on parsing CREATE TABLE statements to extract table names, column names, and simple single-column PRIMARY KEY and FOREIGN KEY definitions. Ignore complex constraints (e.g., CHECK, UNIQUE beyond PKs) initially.  
   * **Task 1.4:** Display a simple textual representation of the parsed schema graph (e.g., list of tables, their columns, and detected FKs) to verify parsing success.  
2. **Day 2: Editor Integration & Static Autocomplete (1 day)**  
   * **Task 2.1:** Integrate CodeMirror 6 into the React application. Create a second input area for typing object-graph paths.  
   * **Task 2.2:** Implement a basic CodeMirror CompletionItemProvider. Initially, this provider will offer static suggestions: all parsed table names when the input is empty, and all columns of the "current" table (e.g., if the user types orders., suggest columns from orders). This will not yet be fully path-aware across joins.  
   * **Task 2.3:** Ensure basic editor functionality (typing, cursor movement) works as expected.  
3. **Day 3: Simple Join Path & SQL Generation \+ Formatting (1 day)**  
   * **Task 3.1:** Extend the CompletionItemProvider to suggest related tables via foreign keys (e.g., orders.customer).  
   * **Task 3.2:** Implement a simplified resolvePathToJoinPlan algorithm. For the PoC, focus on resolving paths with at most one join hop (e.g., table1.table2.column). The algorithm will identify the single FK and the columns to select.  
   * **Task 3.3:** Implement the emitSQL algorithm to generate a SELECT statement with one LEFT JOIN based on the resolved plan. Use a simple aliasing scheme (e.g., t0, t1).  
   * **Task 3.4:** Integrate sql-formatter and apply basic pretty-printing to the generated SQL (e.g., language: 'postgresql', pretty: true).  
   * **Task 3.5:** Display the generated and formatted SQL in a dedicated output area.

### **Success Criteria and Verification Steps**

* **DDL Parsing:**  
  * **Check:** Paste a sample DDL script (e.g., CREATE TABLE orders (...); CREATE TABLE customers (...); ALTER TABLE orders ADD FOREIGN KEY (customer\_id) REFERENCES customers (id);) into the DDL input.  
  * **Verify:** The application successfully parses the DDL and displays the table names, their columns, and the detected foreign key relationship between orders and customers. No parsing errors are reported.  
* **Editor & Autocomplete:**  
  * **Check:** Type orders. in the path input editor.  
  * **Verify:** Autocomplete suggestions appear, including columns from the orders table and the related customers table.  
* **SQL Generation (Single Hop):**  
  * **Check:** Type orders.customer.name in the path input editor.  
  * **Verify:** A valid SELECT statement with a single LEFT JOIN is generated in the SQL output area, similar to SELECT t1.name FROM orders AS t0 LEFT JOIN customers AS t1 ON t0.customer\_id \= t1.id;.  
* **SQL Formatting:**  
  * **Check:** Observe the generated SQL.  
  * **Verify:** The SQL is consistently formatted with proper indentation and keywords in uppercase.

### **Estimated Effort and Timeline**

The estimated effort for this minimal PoC is **2-3 days** of focused development by a single developer, assuming familiarity with React, TypeScript, and basic graph data structures. This timeline allows for initial integration, basic functionality implementation, and verification of the core pipeline.

## **8\. Conclusion**

The detailed analysis and architectural design presented in this report confirm the technical feasibility of building a fully client-side, schema-aware SQL query builder for PostgreSQL. By strategically selecting robust, browser-compatible, and performant libraries such as the pgsql-parser ecosystem for DDL processing, CodeMirror 6 for interactive editing, and a combination of pgsql-deparser and sql-formatter for SQL generation and formatting, the application can deliver on its core value proposition.

The proposed architecture, with its clear component separation and state flow, ensures a responsive and maintainable system. The explicit consideration of risks like composite foreign keys, ambiguous relations, and performance on large schemas, coupled with defined mitigation strategies, provides a clear roadmap for addressing potential challenges.

Ultimately, this application will empower developers and analysts by significantly accelerating their SQL query authoring process. The commitment to delivering "learnable output" in the form of clean, readable SQL ensures that the tool not only automates query construction but also enhances the user's understanding of complex database interactions. This combination of efficiency and transparency makes the proposed solution a highly valuable addition to any PostgreSQL development workflow. The minimal proof-of-concept plan demonstrates that the foundational elements can be rapidly validated, paving the way for a full-featured MVP.

#### **Works cited**

1. sql-formatter \- npm, accessed on August 16, 2025, [https://www.npmjs.com/package/sql-formatter](https://www.npmjs.com/package/sql-formatter)  
2. sqlformat: Online SQL Formatter, accessed on August 16, 2025, [https://sqlformat.org/](https://sqlformat.org/)  
3. libpg-query \- NPM, accessed on August 16, 2025, [https://www.npmjs.com/package/libpg-query](https://www.npmjs.com/package/libpg-query)  
4. pgsql-deparser \- NPM, accessed on August 16, 2025, [https://www.npmjs.com/package/pgsql-deparser](https://www.npmjs.com/package/pgsql-deparser)  
5. launchql/pgsql-parser: PostgreSQL Query Parser for Node.js \- GitHub, accessed on August 16, 2025, [https://github.com/launchql/pgsql-parser](https://github.com/launchql/pgsql-parser)  
6. libpg-query CDN by jsDelivr \- A CDN for npm and GitHub, accessed on August 16, 2025, [https://www.jsdelivr.com/package/npm/libpg-query](https://www.jsdelivr.com/package/npm/libpg-query)  
7. Pull requests · launchql/pgsql-parser \- GitHub, accessed on August 16, 2025, [https://github.com/launchql/pgsql-parser/pulls](https://github.com/launchql/pgsql-parser/pulls)  
8. supabase-community/pg-parser: Postgres SQL parser that ... \- GitHub, accessed on August 16, 2025, [https://github.com/supabase-community/pg-parser](https://github.com/supabase-community/pg-parser)  
9. node-sql-parser \- NPM, accessed on August 16, 2025, [https://www.npmjs.com/package/node-sql-parser](https://www.npmjs.com/package/node-sql-parser)  
10. Documentation: 7.0: CREATE TABLE \- PostgreSQL, accessed on August 16, 2025, [https://www.postgresql.org/docs/7.0/sql-createtable.htm](https://www.postgresql.org/docs/7.0/sql-createtable.htm)  
11. Documentation: 17: CREATE TABLE \- PostgreSQL, accessed on August 16, 2025, [https://www.postgresql.org/docs/current/sql-createtable.html](https://www.postgresql.org/docs/current/sql-createtable.html)  
12. @pgsql/types \- npm, accessed on August 16, 2025, [https://npmjs.com/package/@pgsql/types](https://npmjs.com/package/@pgsql/types)  
13. WebAssembly vs JavaScript | The Ultimate Guide \- XenonStack, accessed on August 16, 2025, [https://www.xenonstack.com/blog/webassembly-vs-javascript](https://www.xenonstack.com/blog/webassembly-vs-javascript)  
14. Why is webAssembly function almost 300 time slower than same JS function, accessed on August 16, 2025, [https://stackoverflow.com/questions/48173979/why-is-webassembly-function-almost-300-time-slower-than-same-js-function](https://stackoverflow.com/questions/48173979/why-is-webassembly-function-almost-300-time-slower-than-same-js-function)  
15. CompletionItemProvider | Monaco Editor API, accessed on August 16, 2025, [https://microsoft.github.io/monaco-editor/typedoc/interfaces/languages.CompletionItemProvider.html](https://microsoft.github.io/monaco-editor/typedoc/interfaces/languages.CompletionItemProvider.html)  
16. Custom IntelliSense with Monaco Editor \- Mono Software, accessed on August 16, 2025, [https://mono.software/2017/04/11/custom-intellisense-with-monaco-editor/](https://mono.software/2017/04/11/custom-intellisense-with-monaco-editor/)  
17. Monaco Editor, accessed on August 16, 2025, [https://microsoft.github.io/monaco-editor/](https://microsoft.github.io/monaco-editor/)  
18. Dynamic imports: Speeding up the initial loading time of WebAssembly Studio \- Medium, accessed on August 16, 2025, [https://medium.com/@ollelauribostr/dynamic-imports-speeding-up-the-initial-loading-time-of-webassembly-studio-9f50b975472a](https://medium.com/@ollelauribostr/dynamic-imports-speeding-up-the-initial-loading-time-of-webassembly-studio-9f50b975472a)  
19. monaco-editor-component v0.1.0 Bundlephobia, accessed on August 16, 2025, [https://bundlephobia.com/package/monaco-editor-component](https://bundlephobia.com/package/monaco-editor-component)  
20. Monaco Editor \- Oracle Help Center, accessed on August 16, 2025, [https://docs.oracle.com/en/database/other-databases/essbase/21/lgess/monaco-editor.html](https://docs.oracle.com/en/database/other-databases/essbase/21/lgess/monaco-editor.html)  
21. microsoft/monaco-editor: A browser based code editor \- GitHub, accessed on August 16, 2025, [https://github.com/microsoft/monaco-editor](https://github.com/microsoft/monaco-editor)  
22. CodeMirror Autocompletion Example, accessed on August 16, 2025, [https://codemirror.net/examples/autocompletion/](https://codemirror.net/examples/autocompletion/)  
23. CodeMirror 6 status update \- v6, accessed on August 16, 2025, [https://discuss.codemirror.net/t/codemirror-6-status-update/2792](https://discuss.codemirror.net/t/codemirror-6-status-update/2792)  
24. codemirror \- NPM, accessed on August 16, 2025, [https://www.npmjs.com/package/codemirror](https://www.npmjs.com/package/codemirror)  
25. Minimal setup (because by default v6 is \+50kb compared to v5) \- discuss.CodeMirror, accessed on August 16, 2025, [https://discuss.codemirror.net/t/minimal-setup-because-by-default-v6-is-50kb-compared-to-v5/4514](https://discuss.codemirror.net/t/minimal-setup-because-by-default-v6-is-50kb-compared-to-v5/4514)  
26. Extension:CodeMirror \- MediaWiki, accessed on August 16, 2025, [https://www.mediawiki.org/wiki/Extension:CodeMirror](https://www.mediawiki.org/wiki/Extension:CodeMirror)  
27. observablehq/codemirror.next: The next generation of the CodeMirror in-browser editor, accessed on August 16, 2025, [https://github.com/observablehq/codemirror.next](https://github.com/observablehq/codemirror.next)  
28. CodeMirror \- Wikipedia, accessed on August 16, 2025, [https://en.wikipedia.org/wiki/CodeMirror](https://en.wikipedia.org/wiki/CodeMirror)  
29. CodeMirror Changelog, accessed on August 16, 2025, [https://codemirror.net/docs/changelog/](https://codemirror.net/docs/changelog/)  
30. Issues · codemirror/dev \- GitHub, accessed on August 16, 2025, [https://github.com/codemirror/dev/issues](https://github.com/codemirror/dev/issues)  
31. Multiple Foreign Keys in CRUD PHP: Same Table References Guide, accessed on August 16, 2025, [https://www.phpcrudgenerator.com/tutorials/mysql-two-foreign-keys-pointing-to-the-same-table](https://www.phpcrudgenerator.com/tutorials/mysql-two-foreign-keys-pointing-to-the-same-table)  
32. Create Foreign Key Relationships \- SQL Server \- Microsoft Learn, accessed on August 16, 2025, [https://learn.microsoft.com/en-us/sql/relational-databases/tables/create-foreign-key-relationships?view=sql-server-ver17](https://learn.microsoft.com/en-us/sql/relational-databases/tables/create-foreign-key-relationships?view=sql-server-ver17)  
33. How to Create a Table With Multiple Foreign Keys in SQL? \- GeeksforGeeks, accessed on August 16, 2025, [https://www.geeksforgeeks.org/sql/how-to-create-a-table-with-multiple-foreign-keys-in-sql/](https://www.geeksforgeeks.org/sql/how-to-create-a-table-with-multiple-foreign-keys-in-sql/)  
34. SQL Code Formatter | Formatting SQL Code with SQL Complete \- Devart, accessed on August 16, 2025, [https://www.devart.com/dbforge/sql/sqlcomplete/sql-code-formatter.html](https://www.devart.com/dbforge/sql/sqlcomplete/sql-code-formatter.html)  
35. Activity · sql-formatter-org/sql-formatter \- GitHub, accessed on August 16, 2025, [https://github.com/sql-formatter-org/sql-formatter/activity](https://github.com/sql-formatter-org/sql-formatter/activity)  
36. pgsql-parser \- NPM, accessed on August 16, 2025, [https://www.npmjs.com/package/pgsql-parser](https://www.npmjs.com/package/pgsql-parser)  
37. Graph Algorithms: A Developer's Guide \- PuppyGraph, accessed on August 16, 2025, [https://www.puppygraph.com/blog/graph-algorithms](https://www.puppygraph.com/blog/graph-algorithms)  
38. Graph traversal — bits v0.8 documentation, accessed on August 16, 2025, [https://jdb.github.io/dependencies/bfs\_dfs.html](https://jdb.github.io/dependencies/bfs_dfs.html)  
39. SQL Alias: Everything You Need to Know About AS in SQL \- DbVisualizer, accessed on August 16, 2025, [https://www.dbvis.com/thetable/sql-alias-everything-you-need-to-know-about-as-in-sql/](https://www.dbvis.com/thetable/sql-alias-everything-you-need-to-know-about-as-in-sql/)  
40. SQL: Joins and aliases \- Library Carpentry, accessed on August 16, 2025, [https://librarycarpentry.github.io/lc-sql/06-joins-aliases.html](https://librarycarpentry.github.io/lc-sql/06-joins-aliases.html)  
41. Primary and foreign key constraints \- SQL Server \- Microsoft Learn, accessed on August 16, 2025, [https://learn.microsoft.com/en-us/sql/relational-databases/tables/primary-and-foreign-key-constraints?view=sql-server-ver17](https://learn.microsoft.com/en-us/sql/relational-databases/tables/primary-and-foreign-key-constraints?view=sql-server-ver17)  
42. PostgreSQL Foreign Key \- Neon, accessed on August 16, 2025, [https://neon.com/postgresql/postgresql-tutorial/postgresql-foreign-key](https://neon.com/postgresql/postgresql-tutorial/postgresql-foreign-key)  
43. How to Create a Table With a Foreign Key in SQL? \- GeeksforGeeks, accessed on August 16, 2025, [https://www.geeksforgeeks.org/sql/how-to-create-a-table-with-a-foreign-key-in-sql/](https://www.geeksforgeeks.org/sql/how-to-create-a-table-with-a-foreign-key-in-sql/)  
44. How to join SQL without duplicates \- Quora, accessed on August 16, 2025, [https://www.quora.com/How-do-you-join-SQL-without-duplicates](https://www.quora.com/How-do-you-join-SQL-without-duplicates)  
45. Eliminating Duplicate Entries Using SQL Natural Join \- Squash.io, accessed on August 16, 2025, [https://www.squash.io/eliminating-duplicate-entries-using-sql-natural-join/](https://www.squash.io/eliminating-duplicate-entries-using-sql-natural-join/)  
46. SQL Query to Delete Duplicate Rows \- GeeksforGeeks, accessed on August 16, 2025, [https://www.geeksforgeeks.org/sql/sql-query-to-delete-duplicate-rows/](https://www.geeksforgeeks.org/sql/sql-query-to-delete-duplicate-rows/)  
47. Documentation: 17: 5.10. Schemas \- PostgreSQL, accessed on August 16, 2025, [https://www.postgresql.org/docs/current/ddl-schemas.html](https://www.postgresql.org/docs/current/ddl-schemas.html)  
48. Autocomplete \- UX Patterns for Devs, accessed on August 16, 2025, [https://uxpatterns.dev/en/patterns/forms/autocomplete](https://uxpatterns.dev/en/patterns/forms/autocomplete)
