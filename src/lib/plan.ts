import type { SchemaGraph, Plan, JoinStep, Selection } from './types';

function expandSelections(selections: string[]): Selection[] {
    const byTable = new Map<string, { star: boolean; cols: Set<string> }>();
    for (const id of selections) {
        const [t, c] = id.split('.', 2);
        if (!t) continue;
        let e = byTable.get(t);
        if (!e) { e = { star: false, cols: new Set() }; byTable.set(t, e); }
        if (c === '*') e.star = true; else if (c) e.cols.add(c);
    }
    const out: Selection[] = [];
    for (const [t, e] of byTable) {
        if (e.star) out.push({ table: t, column: '*' });
        else {
            for (const c of Array.from(e.cols).sort()) out.push({ table: t, column: c });
        }
    }
    return out;
}

export function planJoins(graph: SchemaGraph | null, base: string | null, selections: string[]): Plan | null {
    if (!graph || !base || !selections.length) return null;

    // Build adjacency using FKs in both directions
    type Edge = { via: import('./types').ForeignKey; from: string; to: string };
    const adj = new Map<string, Edge[]>();
    for (const t of Object.values(graph.tables)) {
        if (!adj.has(t.name)) adj.set(t.name, []);
        for (const fk of t.fks) {
            // forward
            adj.get(t.name)!.push({ via: fk, from: t.name, to: fk.toTable });
            // reverse
            if (!adj.has(fk.toTable)) adj.set(fk.toTable, []);
            adj.get(fk.toTable)!.push({ via: fk, from: fk.toTable, to: t.name });
        }
    }
    const targets = Array.from(new Set(selections.map(s => s.split('.', 2)[0]).filter(t => t && t !== base)));

    // BFS with lexicographic tie-break on parent id
    const parent = new Map<string, { prev: string; edge: Edge }>();
    const depth = new Map<string, number>();
    const ambiguousAtNode = new Map<string, boolean>();
    const queue: string[] = [base];
    depth.set(base, 0);
    while (queue.length) {
        const cur = queue.shift()!;
        const nextDepth = depth.get(cur)! + 1;
        const nbrs = (adj.get(cur) || []).slice().sort((a, b) => (a.to.localeCompare(b.to) || a.from.localeCompare(b.from)));
        for (const e of nbrs) {
            if (!depth.has(e.to)) {
                depth.set(e.to, nextDepth);
                parent.set(e.to, { prev: cur, edge: e });
                queue.push(e.to);
            } else if (depth.get(e.to) === nextDepth) {
                // Found another equal-cost way to reach e.to
                ambiguousAtNode.set(e.to, true);
            }
        }
    }

    // Reconstruct paths and union directed edges along each path
    const edgeKey = (e: Edge) => `${e.from}->${e.to}|${e.via.fromCols.join(',')}=>${e.via.toCols.join(',')}`;
    const edgeMap = new Map<string, Edge>();
    for (const tgt of targets) {
        if (!depth.has(tgt)) continue; // unreachable; will warn later
        const path: Edge[] = [];
        let t = tgt;
        while (t !== base) {
            const p = parent.get(t)!; path.push(p.edge); t = p.prev;
        }
        path.reverse();
        for (const e of path) edgeMap.set(edgeKey(e), e);
    }

    // Order edges by connectivity from base
    const ordered: Edge[] = [];
    const visited = new Set<string>([base]);
    const pending = new Set(edgeMap.keys());
    while (pending.size) {
        let progressed = false;
        for (const k of Array.from(pending)) {
            const e = edgeMap.get(k)!;
            if (visited.has(e.from) || visited.has(e.to)) {
                ordered.push(e);
                visited.add(e.from); visited.add(e.to);
                pending.delete(k); progressed = true;
            }
        }
        if (!progressed) break;
    }

    // Aliases: base = t0, then BFS over the subgraph formed by `ordered` edges (first-seen order)
    const tableAlias: Record<string, string> = { [base]: 't0' };
    const planNodes = new Set<string>([base]);
    for (const e of ordered) { planNodes.add(e.from); planNodes.add(e.to); }
    const planAdj = new Map<string, Set<string>>();
    for (const n of planNodes) planAdj.set(n, new Set());
    for (const e of ordered) { planAdj.get(e.from)!.add(e.to); planAdj.get(e.to)!.add(e.from); }
    let n = 1;
    const q: string[] = [base];
    const seen = new Set<string>([base]);
    while (q.length) {
        const cur = q.shift()!;
        const nbrs = Array.from(planAdj.get(cur) || []).sort();
        for (const nb of nbrs) {
            if (!seen.has(nb)) {
                seen.add(nb);
                if (!tableAlias[nb]) tableAlias[nb] = `t${n++}`;
                q.push(nb);
            }
        }
    }

    const steps: JoinStep[] = ordered.map(e => ({ from: e.from, to: e.to, fk: e.via }));
    const select = expandSelections(selections);
    const warnings: string[] = [];
    for (const tgt of targets) {
        if (!depth.has(tgt)) warnings.push(`No FK path from ${base} to ${tgt}; omitting its columns.`);
        else if (ambiguousAtNode.get(tgt)) warnings.push(`Multiple equal-cost join paths from ${base} to ${tgt}; choosing one deterministically.`);
    }

    return { base, steps, tableAlias, select, warnings };
}
