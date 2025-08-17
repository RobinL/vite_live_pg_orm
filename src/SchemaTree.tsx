import { useStore } from './store';
import { useState, useMemo } from 'react';

export default function SchemaTree() {
    const schema = useStore((s) => s.schema);
    const selections = useStore((s) => s.selections);
    const toggleSelection = useStore((s) => s.toggleSelection);
    const [q, setQ] = useState('');
    const tables = useMemo(() => {
        const list = schema ? Object.values(schema.tables) : [];
        return list.slice().sort((a, b) => a.name.localeCompare(b.name));
    }, [schema]);
    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return tables;
        return tables.filter((t) => t.name.toLowerCase().includes(needle));
    }, [tables, q]);
    if (!schema) return <p className="text-gray-500">No schema.</p>;

    return (
        <div>
            <input
                className="w-full border p-1 mb-2 text-sm"
                placeholder="Search tables…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
            />
            <ul className="space-y-1">
                {filtered.map((t) => (
                    <li key={t.name}>
                        <details open={false}>
                            <summary className="cursor-pointer flex items-center gap-2 rounded px-1 hover:bg-slate-100">
                                <input
                                    type="checkbox"
                                    className="mr-1"
                                    checked={selections.includes(`${t.name}.*`)}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={() => toggleSelection(`${t.name}.*`)}
                                />
                                {t.name}
                            </summary>
                            <ul className="ml-4">
                                {t.columns.slice().sort((a, b) => a.localeCompare(b)).map((c) => (
                                    <li key={c}>
                                        <label className="inline-flex items-center space-x-1">
                                            <input
                                                type="checkbox"
                                                checked={selections.includes(`${t.name}.${c}`)}
                                                onClick={(e) => e.stopPropagation()}
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
        </div>
    );
}
