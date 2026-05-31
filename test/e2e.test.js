// End-to-end test across all three microservices via the gateway.
// Boots the full stack, then verifies markets pricing, trading fills (with the
// service trace), settlement payouts, and health. Run with: npm test
const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { spawn } = require('node:child_process');
const path = require('node:path');

let proc;
const BASE = 'http://localhost:3000';
const get = (p) => fetch(BASE + p).then((r) => r.json());
const post = (p, b) => fetch(BASE + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) }).then((r) => r.json());
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

before(async () => {
  proc = spawn('node', [path.join(__dirname, '..', 'start.js')], { stdio: 'ignore' });
  for (let i = 0; i < 50; i++) {                 // wait for all 3 services to report healthy
    try { const h = await get('/api/health'); if (h.markets && h.trading && h.settlement) return; } catch {}
    await sleep(200);
  }
  throw new Error('stack did not become healthy');
});

after(() => proc && proc.kill());

test('gateway reports all 3 microservices healthy', async () => {
  const h = await get('/api/health');
  assert.ok(h.markets && h.trading && h.settlement, 'all services up');
});

test('markets-svc serves the World Cup board', async () => {
  const m = await get('/api/markets');
  assert.strictEqual(m.length, 6);
  assert.ok(m[0].yes > 0 && m[0].yes < 100);
});

test('trading-svc fills an order and moves the price (gateway→trading→markets)', async () => {
  const before = (await get('/api/markets')).find((x) => x.id === 'bra-srb').yes;
  const res = await post('/api/orders', { marketId: 'bra-srb', side: 'YES', shares: 40 });
  assert.deepStrictEqual(res.trace, ['gateway', 'trading-svc', 'markets-svc']);
  const after = (await get('/api/markets')).find((x) => x.id === 'bra-srb').yes;
  assert.ok(after > before, 'YES price increased after a YES buy');
});

test('settlement-svc resolves a market and pays out', async () => {
  const r = await post('/api/results', { marketId: 'arg-mex', outcome: 'YES' });
  assert.ok(r.payout >= 0);
  const m = (await get('/api/markets')).find((x) => x.id === 'arg-mex');
  assert.ok(m.resolved && m.outcome === 'YES');
});
