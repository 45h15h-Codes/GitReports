import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    include:     ['src/tests/**/*.test.ts'],
    coverage: {
      provider:  'v8',
      include:   ['src/services/aggregation/**/*.ts'],
      exclude:   ['src/services/aggregation/ingestion.ts'],  // requires network
      reporter:  ['text', 'lcov'],
    },
  },
});
