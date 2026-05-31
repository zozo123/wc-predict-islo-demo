// Tiny HTTP helpers shared by every service. Zero external dependencies —
// just Node built-ins so the whole app runs with `node` and no `npm install`.
const http = require('http');

function send(res, status, body) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': typeof body === 'string' ? 'text/plain' : 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(data);
}

function readJson(req) {
  return new Promise((resolve) => {
    let buf = '';
    req.on('data', (c) => (buf += c));
    req.on('end', () => {
      try { resolve(buf ? JSON.parse(buf) : {}); } catch { resolve({}); }
    });
  });
}

// Minimal JSON client for service-to-service calls.
function call(method, url, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        method,
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : {},
      },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try { resolve(buf ? JSON.parse(buf) : {}); } catch { resolve({}); }
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Pretty, prefixed startup log so the multi-service boot looks great on camera.
function banner(name, port, color) {
  const c = { markets: 36, trading: 33, settlement: 35, gateway: 32 }[color] || 37;
  console.log(`\x1b[${c}m[${name.padEnd(11)}]\x1b[0m listening on :${port}`);
}

module.exports = { send, readJson, call, banner };
