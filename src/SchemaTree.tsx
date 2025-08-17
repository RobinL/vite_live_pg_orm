import { useStore } from './store';

export default function SchemaTree() {
    const schema = useStore((s) => s.schema);
    const selections = useStore((s) => s.selections);
    const toggleSelection = useStore((s) => s.toggleSelection);
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
}
