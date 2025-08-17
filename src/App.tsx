import { useStore } from './store';

import { useEffect } from 'react';
import { parseDDL } from './lib/parseDDL';
import SchemaTree from './SchemaTree';

export default function App() {
  const ddl = useStore((s) => s.ddl);
  const setDDL = useStore((s) => s.setDDL);
  const ddlLen = useStore((s) => s.ddl.length);
  const setSchema = useStore((s) => s.setSchema);
  const base = useStore((s) => s.base);

  useEffect(() => {
    try {
      const g = ddl.trim() ? parseDDL(ddl) : null;
      setSchema(g);
    } catch (e) {
      setSchema(null);
      console.error(e);
    }
  }, [ddl, setSchema]);
  return (
    <div className="h-screen grid grid-cols-1 md:grid-cols-3 gap-2 p-2 font-mono">
      {/* DDL input */}
      <section className="border p-2 flex flex-col">
        <header className="font-bold mb-1">DDL</header>
        <textarea
          className="flex-1 border p-1 resize-none"
          placeholder="Paste CREATE TABLE …"
          value={ddl}
          onChange={e => setDDL(e.target.value)}
        />
      </section>

      {/* Schema tree */}
      <section className="border p-2 overflow-auto">
        <header className="font-bold mb-1">Schema</header>
        {ddlLen ? <SchemaTree /> : <p className="text-gray-500">No schema yet.</p>}
      </section>

      {/* SQL output */}
      <section className="border p-2 overflow-auto bg-gray-50">
        <header className="font-bold mb-1">SQL {base && <span className="text-sm text-gray-500">(base: {base})</span>}</header>
        <pre className="whitespace-pre-wrap text-sm text-gray-700">
          -- SQL appears here
        </pre>
      </section>
    </div>
  );
}
