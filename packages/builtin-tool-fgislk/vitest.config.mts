import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'lcov', 'text-summary'],
    },
    // движок работает с файловой системой и вызывает xmllint — только Node
    environment: 'node',
  },
});
