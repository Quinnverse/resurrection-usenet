// Server startup and API contract tests
const http = require('http');
const { server, store } = require('../combined-server/server.js');

const PORT = 3001; // Use different port for tests

describe('Server', () => {
  let testServer;

  beforeAll((done) => {
    testServer = http.createServer((req, res) => {
      // Reuse the combined server logic but with test state
      // This will be implemented
      res.writeHead(404);
      res.end('Test server not fully implemented');
    });
    testServer.listen(PORT, done);
  });

  afterAll(() => {
    testServer.close();
  });

  test('server starts successfully', async () => {
    expect(testServer.listening).toBe(true);
  });

  test('health endpoint returns 200', async () => {
    const data = await new Promise((resolve, reject) => {
      http.get(`http://localhost:${PORT}/api/health`, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`Status ${res.statusCode}`));
          }
        });
      });
    });
    
    expect(data).toHaveProperty('status', 'ok');
    expect(data).toHaveProperty('timestamp');
  });
});
