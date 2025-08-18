import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { buildGraphFromDDL } from '../../src/lib/buildGraph';
import { planJoins } from '../../src/lib/plan';
import type { SchemaGraph, Plan } from '../../src/lib/types';

export function loadFixture(name: string): string {
    return readFileSync(resolve(__dirname, '..', 'fixtures', name), 'utf8');
}

export function build(
    fixture: string,
    base: string,
    selects: ReadonlyArray<string>
): { graph: SchemaGraph; plan: Plan } {
    const ddl = loadFixture(fixture);
    const graph = buildGraphFromDDL(ddl);
    const plan = planJoins(graph, base, [...selects])!;
    return { graph, plan };
}
