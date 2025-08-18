import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'node',
        include: ['tests/**/*.spec.ts'],
        setupFiles: ['tests/setup.ts'],
        globals: true,
        coverage: {
            provider: 'v8',
            reporter: ['text', 'html'],
            lines: 80,
            functions: 80,
            branches: 70,
            statements: 80,
        },
    },
});
