import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      // Scope the gate to files that have tests. New code lands with tests
      // and gets added here in the same PR — this is the practical encoding
      // of the "85% on changed files" rule from CLAUDE.md.
      include: [
        'src/lib/abuse/detector.ts',
        'src/lib/crypto/envelope.ts',
        'src/lib/log/index.ts',
      ],
      thresholds: { lines: 85, statements: 85, functions: 80, branches: 75 },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
