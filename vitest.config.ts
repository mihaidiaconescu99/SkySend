import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      'server-only': path.resolve(__dirname, './src/test/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    env: {
      CLERK_SECRET_KEY: 'sk_test_vitest',
      SUPABASE_SERVICE_ROLE_KEY: 'supabase_service_role_vitest',
      STRIPE_SECRET_KEY: 'sk_test_vitest',
    },
    globals: true,
    include: ['src/**/__tests__/**/*.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: ['src/lib/**/*.{ts,tsx}'],
    },
  },
});
