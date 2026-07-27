import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * The business layer owns credit charging, workspace role gates and
 * notification delivery — all DB-backed. Without a config of its own these
 * tests match no vitest project and silently never run, so they live here with
 * the same alias map and DB setup the database package uses.
 */
export default defineConfig({
  test: {
    alias: {
      '@/business/server': resolve(__dirname, './src'),
      '@/config': resolve(__dirname, '../app-config/src'),
      // `@/const/*` resolves to two roots in tsconfig; the app-level entries
      // that only exist under `src/const` need an explicit alias here.
      '@/const/locale': resolve(__dirname, '../../src/const/locale'),
      '@/const': resolve(__dirname, '../const/src'),
      '@/database': resolve(__dirname, '../database/src'),
      '@/envs': resolve(__dirname, '../env/src'),
      '@/libs/model-runtime': resolve(__dirname, '../model-runtime/src'),
      '@/libs/trpc': resolve(__dirname, '../trpc/src'),
      '@/locales': resolve(__dirname, '../locales/src'),
      '@/server/modules': resolve(__dirname, '../../apps/server/src/modules'),
      '@/server/services': resolve(__dirname, '../../apps/server/src/services'),
      '@/types': resolve(__dirname, '../types/src'),
      '@/utils/errorResponse': resolve(__dirname, '../../src/utils/errorResponse'),
      '@/utils/i18n': resolve(__dirname, '../../src/utils/i18n'),
      '@/utils': resolve(__dirname, '../utils/src'),
      '@': resolve(__dirname, '../../src'),
    },
    environment: 'node',
    exclude: ['node_modules/**/**'],
    setupFiles: '../database/tests/setup-db.ts',
  },
});
