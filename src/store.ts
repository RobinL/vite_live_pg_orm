import { create } from 'zustand';
import type { SchemaGraph } from './lib/types';
import { toggleSelectionReducer } from './lib/selectionReducer';

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
            const [table] = id.split('.', 2);
            const next = toggleSelectionReducer(s.selections, id);

            // Base handling:
            // 1) If current base has no remaining selections, clear it.
            // 2) If we ADDED a selection and base is unset, set base to this table.
            const baseHasSelections = s.base ? next.some((x) => x.startsWith(`${s.base}.`)) : false;
            let base: string | null = baseHasSelections ? s.base : null;
            if (!isSelected && !base) base = table || null;
            return { selections: next, base };
        }),
}));
