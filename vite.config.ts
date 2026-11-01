/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    define: {
      'process.env.FRONTEND_URL': JSON.stringify(env.FRONTEND_URL),
      'process.env.BACKEND_URL': JSON.stringify(env.BACKEND_URL),
    },
    plugins: [react()],
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './src/setupTests.ts',
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html', 'lcov'],
        exclude: ['node_modules/', 'dist/', 'cypress/', 'src/setupTests.ts', '**/*.d.ts'],
        thresholds: {
          'src/utils/httpSnippetOperations.ts': {
            lines: 80,
            functions: 80,
            branches: 80,
            statements: 80,
          },
        },
      },
    },
  };
});
