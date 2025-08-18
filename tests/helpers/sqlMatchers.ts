import { canonicalize } from './canon';

expect.extend({
    toEmitSQL(received: string, expected: string) {
        const pass = canonicalize(received) === canonicalize(expected);
        return {
            pass,
            message: () => `Expected SQL to equal (canon):\n${expected}\nGot:\n${received}`,
        };
    },
});

declare module 'vitest' {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    interface Assertion<T = any> {
        toEmitSQL(expected: string): T
    }
}
