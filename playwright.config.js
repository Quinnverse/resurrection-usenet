// Playwright configuration for the browser suite (npm run test:e2e). The unit and integration suite
// (npm test) does not use this file and has no dependencies.
//
// Local/CI default: starts the server on port 3999 with a temporary save directory.
// Live check: set E2E_BASE_URL (and E2E_USER / E2E_PASSWORD if the address is protected). No local server is started.
const os = require('node:os');
const path = require('node:path');

const PORT = 3999;
const LIVE = process.env.E2E_BASE_URL;

module.exports = {
  testDir: './e2e',
  timeout: 120000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: LIVE || `http://127.0.0.1:${PORT}`,
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure',
    ...(LIVE && process.env.E2E_USER
      ? { httpCredentials: { username: process.env.E2E_USER, password: process.env.E2E_PASSWORD || '' } }
      : {})
  },
  ...(LIVE
    ? {}
    : {
        webServer: {
          command: 'node combined-server/server.js',
          url: `http://127.0.0.1:${PORT}/api/health`,
          reuseExistingServer: false,
          timeout: 30000,
          env: {
            PORT: String(PORT),
            RESURRECTION_DATA_DIR: path.join(os.tmpdir(), `resurrection-e2e-${process.pid}`)
          }
        }
      })
};
