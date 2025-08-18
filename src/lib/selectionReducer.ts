export function toggleSelectionReducer(prev: string[], id: string): string[] {
    const [table, rest] = id.split('.', 2);
    const isStar = rest === '*';
    const isSelected = prev.includes(id);

    let next = isSelected ? prev.filter(x => x !== id) : [...prev, id];
    if (!isSelected) {
        if (isStar) next = next.filter(x => !x.startsWith(`${table}.`) || x === id);
        else next = next.filter(x => x !== `${table}.*`);
    }
    // deterministic
    return Array.from(new Set(next)).sort();
}
