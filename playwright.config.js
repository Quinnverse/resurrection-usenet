// Playwright configuration for the browser suite (npm run test:e2e). The unit and integration suite
// (npm test) does not use this file and has no dependencies.
const os = require('node:os');
const path = require('node:path');

const PORT = 3999;

module.exports = {
  testDir: './e2e',
  timeout: 120000,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    browserName: 'chromium',
    headless: true,
    trace: 'retain-on-failure'
  },
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
};
