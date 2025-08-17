import { create } from 'zustand';

export interface SchemaGraph { tables: Record<string, unknown> } // temp

export const useStore = create<{
    ddl: string;
    setDDL: (s: string) => void;
    schema: SchemaGraph | null;
    setSchema: (g: SchemaGraph | null) => void;
    selections: string[];                // 'table.*' or 'table.column'
    toggleSelection: (id: string) => void;
}>((set) => ({
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
