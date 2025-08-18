import { useStore } from './store';
import { useState, useMemo, useCallback, useRef } from 'react';
import type { SchemaGraph } from './lib/types';
import IndeterminateCheckbox from './components/IndeterminateCheckbox';
import { ChevronRight, Table2, List } from 'lucide-react';

type CheckState = 'all' | 'some' | 'none';

function getTableCheckState(table: string, selections: string[], columns: string[]): CheckState {
    const hasStar = selections.includes(`${table}.*`);
    if (hasStar) return 'all';
    const picked = columns.filter((c) => selections.includes(`${table}.${c}`)).length;
    if (picked === 0) return 'none';
    if (picked === columns.length) return 'all';
    return 'some';
}

function getColumnBadges(table: string, col: string, graph: SchemaGraph) {
    const t = graph.tables[table];
    const isPK = !!t?.primaryKey?.includes(col);
    const isFK = !!t?.fks?.some((fk) => fk.fromCols.includes(col));
    return { isPK, isFK };
}

export default function SchemaTree() {
    const schema = useStore((s) => s.schema);
    const selections = useStore((s) => s.selections);
    const toggleSelection = useStore((s) => s.toggleSelection);

    const [q, setQ] = useState('');
    const [open, setOpen] = useState<Record<string, boolean>>({});
    const treeRef = useRef<HTMLUListElement>(null);

    const tables = useMemo(() => {
        const list = schema ? Object.values(schema.tables) : [];
        return list.slice().sort((a, b) => a.name.localeCompare(b.name));
    }, [schema]);

    const filtered = useMemo(() => {
        const needle = q.trim().toLowerCase();
        if (!needle) return tables;
        return tables.filter((t) => t.name.toLowerCase().includes(needle));
    }, [tables, q]);

    const toggleOpen = useCallback((name: string) => {
        setOpen((o) => ({ ...o, [name]: !o[name] }));
    }, []);

    const expandAll = useCallback(() => {
        if (!schema) return;
        const next: Record<string, boolean> = {};
        for (const name of Object.keys(schema.tables)) next[name] = true;
        setOpen(next);
    }, [schema]);

    const collapseAll = useCallback(() => {
        if (!schema) return;
        const next: Record<string, boolean> = {};
        for (const name of Object.keys(schema.tables)) next[name] = false;
        setOpen(next);
    }, [schema]);

    const selectAll = useCallback((table: string) => {
        const star = `${table}.*`;
        if (!selections.includes(star)) toggleSelection(star);
    }, [selections, toggleSelection]);

    const selectNone = useCallback((table: string) => {
        // Remove star and any selected columns for this table
        const ids = selections.filter((s) => s === `${table}.*` || s.startsWith(`${table}.`));
        for (const id of ids) toggleSelection(id);
    }, [selections, toggleSelection]);

    if (!schema) return <p className="text-gray-500">No schema.</p>;

    return (
        <div className="font-sans">
            <div className="sticky top-0 bg-white/90 backdrop-blur pb-2">
                <input
                    className="w-full border rounded px-2 py-1 text-sm"
                    placeholder="Search tables…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                />
                {schema && (
                    <div className="mt-1 flex gap-2">
                        <button
                            className="px-2 py-1 text-xs border rounded hover:bg-slate-50"
                            onClick={expandAll}
                        >
                            Expand all
                        </button>
                        <button
                            className="px-2 py-1 text-xs border rounded hover:bg-slate-50"
                            onClick={collapseAll}
                        >
                            Collapse all
                        </button>
                    </div>
                )}
            </div>

            <ul role="tree" ref={treeRef} className="space-y-1 mt-2">
                {filtered.map((t) => {
                    const isOpen = !!open[t.name];
                    const state = getTableCheckState(t.name, selections, t.columns);
                    const starred = selections.includes(`${t.name}.*`);
                    return (
                        <li key={t.name} role="treeitem" aria-expanded={isOpen}>
                            <div
                                className="flex items-center gap-2 rounded px-2 py-1 hover:bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-300"
                                tabIndex={0}
                                data-tree-row
                                onClick={(e) => {
                                    // Don't toggle when interacting with inner controls
                                    const target = e.target as HTMLElement;
                                    if (target.closest('button,input,label')) return;
                                    toggleOpen(t.name);
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'ArrowRight') {
                                        if (!isOpen) { e.preventDefault(); toggleOpen(t.name); }
                                    } else if (e.key === 'ArrowLeft') {
                                        if (isOpen) { e.preventDefault(); toggleOpen(t.name); }
                                    } else if (e.key === ' ') {
                                        e.preventDefault();
                                        toggleSelection(`${t.name}.*`);
                                    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                                        const rows = treeRef.current?.querySelectorAll<HTMLDivElement>('[data-tree-row]');
                                        if (!rows || rows.length === 0) return;
                                        const arr = Array.from(rows);
                                        const idx = arr.findIndex((el) => el === e.currentTarget);
                                        if (idx === -1) return;
                                        e.preventDefault();
                                        const nextIdx = e.key === 'ArrowDown' ? Math.min(arr.length - 1, idx + 1) : Math.max(0, idx - 1);
                                        arr[nextIdx].focus();
                                    }
                                }}
                            >
                                <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
                                <IndeterminateCheckbox
                                    state={state}
                                    onChange={() => toggleSelection(`${t.name}.*`)}
                                />
                                <Table2 className="w-4 h-4 text-slate-600 shrink-0" />
                                <span className="font-semibold font-mono">{t.name}</span>
                                <span className="ml-auto text-xs text-slate-600 border rounded px-1">
                                    {t.columns.length}
                                </span>
                                <div className="ml-2 hidden sm:flex gap-1 text-xs">
                                    <button
                                        className="px-1 border rounded hover:bg-slate-50"
                                        onClick={(e) => { e.stopPropagation(); selectAll(t.name); }}
                                    >
                                        All
                                    </button>
                                    <button
                                        className="px-1 border rounded hover:bg-slate-50"
                                        onClick={(e) => { e.stopPropagation(); selectNone(t.name); }}
                                    >
                                        None
                                    </button>
                                </div>
                            </div>

                            {isOpen && (
                                <ul role="group" className="ml-6 border-l pl-3 space-y-1">
                                    {t.columns.slice().sort().map((c) => {
                                        const id = `${t.name}.${c}`;
                                        const { isPK, isFK } = getColumnBadges(t.name, c, schema);
                                        const checked = selections.includes(id);
                                        return (
                                            <li
                                                key={id}
                                                className={`flex items-center gap-2 ${starred ? 'opacity-50' : ''}`}
                                            >
                                                <span className="w-4 h-4" />
                                                <input
                                                    type="checkbox"
                                                    disabled={starred}
                                                    checked={checked}
                                                    onChange={(e) => { e.stopPropagation(); toggleSelection(id); }}
                                                />
                                                <List className="w-4 h-4 text-slate-600" />
                                                <span className="font-mono text-sm text-slate-800">{c}</span>
                                                {(isPK || isFK) && (
                                                    <span className="ml-2 flex gap-1 text-[10px]">
                                                        {isPK && <span className="px-1 rounded bg-slate-100 text-slate-700 border">PK</span>}
                                                        {isFK && <span className="px-1 rounded bg-slate-100 text-slate-700 border">FK</span>}
                                                    </span>
                                                )}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
