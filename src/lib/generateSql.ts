import { format } from 'sql-formatter';
import type { SchemaGraph } from '../store';

type Edge = {
    from: string;
    to: string;
    fromCols: string[];
    toCols: string[];
};

export function generateSql(
    schema: SchemaGraph | null,
    base: string | null,
    sels: string[]
): { sql: string; warnings: string[] } {
    if (!schema || !base) return { sql: '-- select columns to start', warnings: [] };

    // Build selection map per table
    const selMap = new Map<string, { star: boolean; cols: Set<string> }>();
    for (const id of sels) {
        const [t, c] = id.split('.', 2);
        if (!t) continue;
        let entry = selMap.get(t);
        if (!entry) {
            entry = { star: false, cols: new Set() };
            selMap.set(t, entry);
        }
        if (c === '*') entry.star = true;
        else entry.cols.add(c);
    }
    if (!selMap.size) return { sql: '-- select columns to start', warnings: [] };

    // Build FK graph (bidirectional edges so BFS can find paths regardless of direction)
    const graph: Record<string, Edge[]> = {};
    for (const t of Object.values(schema.tables)) {
        if (!graph[t.name]) graph[t.name] = [];
        for (const fk of t.fks || []) {
            // forward: t -> fk.toTable
            graph[t.name].push({ from: t.name, to: fk.toTable, fromCols: fk.fromCols, toCols: fk.toCols });
            // reverse: fk.toTable -> t
            if (!graph[fk.toTable]) graph[fk.toTable] = [];
            graph[fk.toTable].push({ from: fk.toTable, to: t.name, fromCols: fk.toCols, toCols: fk.fromCols });
        }
    }

    const targetTables = Array.from(selMap.keys()).filter((t) => t !== base);
    const warnings: string[] = [];

    const shortestPathBFS = (start: string, goal: string): Edge[] | null => {
        if (start === goal) return [];
        const q: string[] = [start];
        const visited = new Set<string>([start]);
        const parent: Record<string, { prev: string; edge: Edge } | undefined> = {};
        while (q.length) {
            const cur = q.shift()!;
            for (const e of graph[cur] || []) {
                const nxt = e.to;
                if (!visited.has(nxt)) {
                    visited.add(nxt);
                    parent[nxt] = { prev: cur, edge: e };
                    if (nxt === goal) {
                        // reconstruct
                        const path: Edge[] = [];
                        let t = goal;
                        while (t !== start) {
                            const p = parent[t]!;
                            path.push(p.edge);
                            t = p.prev;
                        }
                        path.reverse();
                        return path;
                    }
                    q.push(nxt);
                }
            }
        }
        return null;
    };

    // Collect union of edges from base to each target
    const paths: Edge[][] = [];
    for (const tgt of targetTables) {
        const path = shortestPathBFS(base, tgt);
        if (!path) {
            warnings.push(`No FK path from ${base} to ${tgt}; omitting its columns.`);
            continue;
        }
        paths.push(path);
    }
    const edgeKey = (e: Edge) => `${e.from}->${e.to}|${e.fromCols.join(',')}=>${e.toCols.join(',')}`;
    const unionMap = new Map<string, Edge>();
    for (const p of paths) {
        for (const e of p) unionMap.set(edgeKey(e), e);
    }
    const unionEdges = Array.from(unionMap.values());

    // Order edges so we can join incrementally from base
    const ordered: Edge[] = [];
    const visitedTables = new Set<string>([base]);
    const pending = new Set(unionEdges.map(edgeKey));
    const edgeByKey = new Map(unionEdges.map((e) => [edgeKey(e), e] as const));
    while (pending.size) {
        let progressed = false;
        for (const k of Array.from(pending)) {
            const e = edgeByKey.get(k)!;
            if (visitedTables.has(e.from) || visitedTables.has(e.to)) {
                ordered.push(e);
                visitedTables.add(e.from);
                visitedTables.add(e.to);
                pending.delete(k);
                progressed = true;
            }
        }
        if (!progressed) break; // cycle or disconnected (shouldn't happen with BFS union)
    }

    // Assign aliases: base = t0, then new tables as encountered in ordered edges
    const alias = new Map<string, string>([[base, 't0']]);
    let nextAliasNum = 1;
    for (const e of ordered) {
        for (const t of [e.from, e.to]) {
            if (!alias.has(t)) {
                alias.set(t, `t${nextAliasNum++}`);
            }
        }
    }

    // Build SELECT list, only for reachable tables
    const reachable = new Set<string>(alias.keys());
    const selectItems: string[] = [];
    const tablesInOrder = [base, ...Array.from(reachable).filter((t) => t !== base)];
    for (const t of tablesInOrder) {
        const sel = selMap.get(t);
        if (!sel) continue;
        const a = alias.get(t)!;
        if (sel.star) {
            selectItems.push(`${a}.*`);
        } else {
            const cols = Array.from(sel.cols).sort((a, b) => a.localeCompare(b));
            for (const c of cols) selectItems.push(`${a}."${c}"`);
        }
    }
    if (!selectItems.length) return { sql: '-- select columns to start', warnings };

    // Build FROM + JOINs
    const lines: string[] = [];
    lines.push('SELECT');
    lines.push('  ' + selectItems.join(',\n  '));
    lines.push('FROM');
    lines.push(`  ${base} AS ${alias.get(base)!}`);
    for (const e of ordered) {
        const l = alias.get(e.from)!;
        const r = alias.get(e.to)!;
        const pairs = Math.min(e.fromCols.length, e.toCols.length);
        const onParts: string[] = [];
        for (let i = 0; i < pairs; i++) {
            onParts.push(`${l}."${e.fromCols[i]}" = ${r}."${e.toCols[i]}"`);
        }
        const onClause = onParts.length ? onParts.join(' AND ') : '1=1';
        lines.push(`LEFT JOIN ${e.to} AS ${r} ON ${onClause}`);
    }

    const sql = format(lines.join('\n') + ';', {
        language: 'postgresql',
        keywordCase: 'upper',
    });
    return { sql, warnings };
}
