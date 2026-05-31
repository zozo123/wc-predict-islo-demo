// gateway — the single public port (3000). Serves the web UI and proxies the
// browser's /api/* calls to the three backend microservices. This is the only
// thing we expose with `islo share`, and the only URL Carbonyl opens.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { send, call, banner } = require('../lib/http');

const PORT = process.env.PORT || 3000;
const MARKETS = process.env.MARKETS_URL || 'http://localhost:4001';
const TRADING = process.env.TRADING_URL || 'http://localhost:4002';
const SETTLEMENT = process.env.SETTLEMENT_URL || 'http://localhost:4003';

const WEB = path.join(__dirname, '..', 'web');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript' };

function serveStatic(res, file) {
  const full = path.join(WEB, file === '/' ? 'index.html' : file);
  fs.readFile(full, (err, data) => {
    if (err) return send(res, 404, 'not found');
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(full)] || 'text/plain' });
    res.end(data);
  });
}

async function proxy(req, res, target) {
  try {
    let body = null;
    if (req.method === 'POST') {
      body = await new Promise((r) => { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => r(b ? JSON.parse(b) : {})); });
    }
    const out = await call(req.method, target, body);
    return send(res, 200, out);
  } catch (e) {
    return send(res, 502, { error: 'upstream unavailable', detail: String(e) });
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const p = url.pathname;

  // Aggregate health across all three microservices (drives the UI's live chips).
  if (p === '/api/health') {
    return Promise.allSettled([
      call('GET', `${MARKETS}/health`), call('GET', `${TRADING}/health`), call('GET', `${SETTLEMENT}/health`),
    ]).then(([m, t, s]) => send(res, 200, {
      markets: m.status === 'fulfilled' && m.value.ok,
      trading: t.status === 'fulfilled' && t.value.ok,
      settlement: s.status === 'fulfilled' && s.value.ok,
    }));
  }

  // API surface — routed to the right microservice.
  if (p === '/api/markets') return proxy(req, res, `${MARKETS}/markets`);
  if (p === '/api/orders') return proxy(req, res, `${TRADING}/orders`);
  if (p === '/api/positions') return proxy(req, res, `${TRADING}/positions`);
  if (p === '/api/results') return proxy(req, res, `${SETTLEMENT}/results`);

  // Everything else is the static web app.
  return serveStatic(res, p);
});

server.listen(PORT, () => {
  banner('gateway', PORT, 'gateway');
  console.log(`\x1b[32m[gateway]\x1b[0m  ▸ World Cup prediction market ready at http://localhost:${PORT}`);
});
