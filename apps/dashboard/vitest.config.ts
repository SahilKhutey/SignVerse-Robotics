import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/tests/**/*.test.{ts,tsx}'],
    // Provide required env vars so Zod validation in env.ts passes in unit tests
    env: {
      VITE_API_URL: 'http://localhost:8000',
      VITE_WS_URL: 'ws://localhost:8000',
    },
  },
});
