import type { Plan } from '../../src/lib/types';

expect.extend({
    toHaveJoinPath(received: Plan, expected: ReadonlyArray<string>) {
        const actual = received.steps.map(s => `${s.from}->${s.to}`);
        const pass = Array.isArray(expected) &&
            actual.length === expected.length &&
            actual.every((v, i) => v === expected[i]);
        return {
            pass,
            message: () => pass
                ? `expected plan not to have join path ${JSON.stringify(expected)}`
                : `expected join path ${JSON.stringify(expected)}, but got ${JSON.stringify(actual)}`,
        };
    }
});

declare module 'vitest' {
    interface Assertion<T = any> {
        toHaveJoinPath(expected: ReadonlyArray<string>): T
    }
}
