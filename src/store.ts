import { create } from 'zustand';
import type { Table } from './lib/parseDDL';

export interface SchemaGraph { tables: Record<string, Table> }

export const useStore = create<{
    ddl: string;
    setDDL: (s: string) => void;
    schema: SchemaGraph | null;
    setSchema: (g: SchemaGraph | null) => void;
    selections: string[];                // 'table.*' or 'table.column'
    toggleSelection: (id: string) => void;
    base: string | null;
    setBase: (tbl: string | null) => void;
}>((set) => ({
    ddl: '',
    setDDL: (ddl) => set({ ddl }),
    schema: null,
    setSchema: (schema) => set({ schema }),
    selections: [],
    base: null,
    setBase: (tbl) => set({ base: tbl }),
    toggleSelection: (id) =>
        set((s) => {
            const isSelected = s.selections.includes(id);
            const [table, rest] = id.split('.', 2);
            const isStar = rest === '*';

            // Start from current selections, then toggle
            let next = isSelected
                ? s.selections.filter((x) => x !== id)
                : [...s.selections, id];

            if (!isSelected) {
                if (isStar) {
                    // Selecting table.* removes any table.column entries for that table
                    next = next.filter((x) => !x.startsWith(`${table}.`) || x === id);
                } else {
                    // Selecting a column removes table.* if present
                    next = next.filter((x) => x !== `${table}.*`);
                }
            }

            // If base is not yet set and this selection relates to a table, set it
            const base = s.base ?? table ?? null;
            return { selections: next, base };
        }),
}));
