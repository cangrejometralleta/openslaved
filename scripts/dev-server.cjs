'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const port = Number(process.env.PORT || process.argv[2] || 4173);
const ignored = new Set(['.git', 'node_modules']);
const types = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.cjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};
const clients = new Set();
let previous = snapshot();

function snapshot() {
  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && ignored.has(entry.name)) continue;
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(fullPath);
      else {
        const stat = fs.statSync(fullPath);
        files.push(`${path.relative(root, fullPath)}:${stat.size}:${stat.mtimeMs}`);
      }
    }
  }
  walk(root);
  return files.sort().join('\n');
}

function sendReload() {
  for (const response of clients) response.write('data: reload\n\n');
}

setInterval(() => {
  const current = snapshot();
  if (current === previous) return;
  previous = current;
  sendReload();
}, 400).unref();

const server = http.createServer((request, response) => {
  const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;
  if (pathname === '/__reload') {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    response.write(': connected\n\n');
    clients.add(response);
    request.on('close', () => clients.delete(response));
    return;
  }

  let filePath;
  try {
    filePath = path.resolve(root, `.${decodeURIComponent(pathname)}`);
  } catch {
    response.writeHead(400).end('Bad request');
    return;
  }
  if (filePath !== root && !filePath.startsWith(`${root}${path.sep}`)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  if (pathname.endsWith('/')) filePath = path.join(filePath, 'index.html');

  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(error.code === 'ENOENT' ? 404 : 500).end('Not found');
      return;
    }
    if (path.extname(filePath) === '.html') {
      const liveReload = '<script>new EventSource("/__reload").onmessage=()=>location.reload()</script>';
      contents = Buffer.from(contents.toString().replace('</body>', `${liveReload}</body>`));
    }
    response.writeHead(200, {
      'Content-Type': types[path.extname(filePath)] || 'application/octet-stream',
      'Cache-Control': 'no-store',
    }).end(contents);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`OpenSlaved dev server: http://127.0.0.1:${port}`);
  console.log('Edit a file and the page reloads in Chrome automatically. Ctrl+C stops the server.');
});

server.on('error', error => {
  if (error.code !== 'EADDRINUSE') {
    console.error(`Could not start dev server: ${error.message}`);
    process.exitCode = 1;
    return;
  }
  http.get(`http://127.0.0.1:${port}/`, response => {
    let page = '';
    response.setEncoding('utf8');
    response.on('data', chunk => { page += chunk; });
    response.on('end', () => {
      if (response.statusCode === 200 && page.includes('<title>OpenSlaved')) {
        console.log(`OpenSlaved dev server is already running: http://127.0.0.1:${port}`);
        console.log('Keep using that page; saved changes reload automatically.');
        return;
      }
      console.error(`Port ${port} is already in use. Choose another with PORT=4174 npm run dev.`);
      process.exitCode = 1;
    });
  }).on('error', () => {
    console.error(`Port ${port} is busy, but the existing server did not answer.`);
    process.exitCode = 1;
  });
});
