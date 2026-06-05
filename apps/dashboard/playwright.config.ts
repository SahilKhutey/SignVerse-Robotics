import { defineConfig } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 120000,
  fullyParallel: false,   // WS state is shared — run sequentially
  workers: 1,
  retries: 2,             // Flaky WS tests get 2 retries
  reporter: [['html'],['line']],
  expect: {
    timeout: 15000,
  },
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      args: [
        '--enable-precise-memory-info',
        '--disable-gpu-vsync',
        '--disable-frame-rate-limit',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    }
  },
  webServer: [
    {
      command: 'python -m uvicorn gateway:app --port 8000',
      url: 'http://localhost:8000/api/status',
      cwd: '../../core/deployment/api_gateway',
      env: {
        PYTHONPATH: path.resolve(__dirname, '../..'),
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'pnpm --filter @signverse/dashboard dev',
      url: 'http://localhost:5173',
      env: {
        VITE_API_URL: 'http://localhost:8000',
        VITE_WS_URL: 'ws://localhost:8000',
      },
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    }
  ]
})
