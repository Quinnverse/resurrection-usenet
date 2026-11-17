const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5173;

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.jsx': 'application/javascript'
};

const PUBLIC_DIR = __dirname;

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, 'http://localhost:' + PORT);
  let filePath = path.join(PUBLIC_DIR, parsed.pathname);

  if (parsed.pathname === '/' || !path.extname(parsed.pathname)) {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  res.setHeader('Content-Type', MIME_TYPES[ext] || 'application/octet-stream');

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
    } else {
      res.writeHead(200);
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log('Resurrection Frontend running on port ' + PORT);
});
