import { useStore } from './store';

import { useEffect, useState } from 'react';
import { parseDDL } from './lib/parseDDL';
import { generateSql } from './lib/generateSql';
import SchemaTree from './SchemaTree';

export default function App() {
  const ddl = useStore((s) => s.ddl);
  const setDDL = useStore((s) => s.setDDL);
  const ddlLen = useStore((s) => s.ddl.length);
  const setSchema = useStore((s) => s.setSchema);
  const base = useStore((s) => s.base);
  const schema = useStore((s) => s.schema);
  const selections = useStore((s) => s.selections);
  const [parseError, setParseError] = useState<string | null>(null);

  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const g = ddl.trim() ? parseDDL(ddl) : null;
        setSchema(g);
        setParseError(null);
      } catch (e: unknown) {
        setSchema(null);
        const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message?: unknown }).message) : 'Parse error';
        setParseError(msg);
        console.error(e);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [ddl, setSchema]);
  return (
    <div className="h-screen grid grid-cols-1 md:grid-cols-3 gap-2 p-2 font-mono">
      {/* DDL input */}
      <section className="border p-2 flex flex-col">
        <header className="font-bold mb-1">DDL</header>
        <details open={false} className="mb-2">
          <summary className="cursor-pointer font-medium rounded px-1 hover:bg-slate-100">Instructions</summary>
          <div className="text-sm space-y-3 mt-2">
            <div>
              <p className="font-semibold">How to use</p>
              <ol className="list-decimal pl-5 space-y-1 mt-1">
                <li>Paste your PostgreSQL schema DDL (CREATE TABLE / ALTER TABLE) into the textarea.</li>
                <li>Wait ~300ms while it parses; any errors appear in the Schema pane.</li>
                <li>Expand tables and check either <code>table.*</code> or individual columns.</li>
                <li>Star vs columns are mutually exclusive per table; the first table you add becomes the base.</li>
                <li>The SQL pane shows a formatted SELECT with LEFT JOINs; use the Copy button to copy SQL.</li>
                <li>Use the search box above the tree to quickly filter large schemas.</li>
              </ol>
            </div>
            <div>
              <p className="font-semibold">Dumping your schema (generic Postgres)</p>
              <p className="mt-1">Option 1 — From a local/network Postgres:</p>
              <pre className="bg-slate-100 p-2 overflow-auto text-xs"><code>{`# list tables (optional)
psql -h <host> -p <port> -U <user> -d <database> -c "\\dt"

# dump schema-only (plain SQL) to a file you can paste here
pg_dump -h <host> -p <port> -U <user> -d <database> -s -O -x --no-comments \
  > schema.sql`}</code></pre>
              <p className="mt-2">Option 2 — When Postgres runs in Docker:</p>
              <pre className="bg-slate-100 p-2 overflow-auto text-xs"><code>{`# run pg_dump inside the container and write to a host file
docker exec <container_name> \
  pg_dump -U <user> -d <database> -s -O -x --no-comments \
  > schema.sql`}</code></pre>
              <p className="mt-2">Optional — produce a concise schema (tables + PK/FK/UNIQUE only):</p>
              <pre className="bg-slate-100 p-2 overflow-auto text-xs"><code>{`# create a custom-format archive
pg_dump -h <host> -p <port> -U <user> -d <database> -s -O -x --no-comments -Fc \
  -f /tmp/db.dump

# list contents and keep only schema/table/constraints lines
pg_restore -l /tmp/db.dump > toc.list
awk '/ SCHEMA / || / TABLE / || (/ CONSTRAINT / && (/ PRIMARY KEY / || / FOREIGN KEY / || / UNIQUE /))' toc.list > keep.list
pg_restore -L keep.list -f concise.sql /tmp/db.dump`}</code></pre>
            </div>
          </div>
        </details>
        <textarea
          className="flex-1 border p-1 resize-none font-mono"
          placeholder="Paste CREATE TABLE …"
          value={ddl}
          onChange={e => setDDL(e.target.value)}
          rows={Math.min(20, Math.max(8, ddl.split('\n').length + 2))}
        />
      </section>

      {/* Schema tree */}
      <section className="border p-2 overflow-auto">
        <header className="font-bold mb-1">Schema</header>
        {parseError && <p className="text-red-600 text-sm mb-1">{parseError}</p>}
        {ddlLen ? <SchemaTree /> : <p className="text-gray-500">No schema yet.</p>}
      </section>

      {/* SQL output */}
      <section className="border p-2 overflow-auto bg-gray-50">
        <header className="font-bold mb-1 sticky top-0 bg-gray-50/80 backdrop-blur z-10 flex items-center justify-between">
          <span>SQL {base && <span className="text-sm text-gray-500">(base: {base})</span>}</span>
          <button
            className="text-xs border rounded px-2 py-1 hover:bg-slate-100"
            onClick={() => {
              const { sql } = generateSql(schema, base, selections);
              navigator.clipboard.writeText(sql);
            }}
          >Copy</button>
        </header>
        {(() => {
          const { sql, warnings } = generateSql(schema, base, selections); return (
            <>
              {warnings.length > 0 && (
                <ul className="mb-2 text-sm text-amber-700 list-disc pl-5">
                  {warnings.map((w, i) => (<li key={i}>{w}</li>))}
                </ul>
              )}
              <pre className="whitespace-pre-wrap text-sm text-gray-700">{sql}</pre>
            </>
          );
        })()}
      </section>
    </div>
  );
}
