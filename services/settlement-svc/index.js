// settlement-svc — ingests match results, resolves the market in markets-svc,
// and triggers payouts in trading-svc.
const http = require('http');
const { send, readJson, call, banner } = require('../../lib/http');

const PORT = process.env.SETTLEMENT_PORT || 4003;
const MARKETS = process.env.MARKETS_URL || 'http://localhost:4001';
const TRADING = process.env.TRADING_URL || 'http://localhost:4002';

const results = []; // { marketId, outcome, payout, ts }

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/results')
    return send(res, 200, results);

  // A final score arrives → resolve the market, then settle positions.
  if (req.method === 'POST' && url.pathname === '/results') {
    const { marketId, outcome } = await readJson(req); // outcome: 'YES' (home won) | 'NO'
    if (!marketId || (outcome !== 'YES' && outcome !== 'NO'))
      return send(res, 400, { error: 'marketId and outcome (YES|NO) required' });

    await call('POST', `${MARKETS}/markets/${marketId}/resolve`, { outcome });
    const settled = await call('POST', `${TRADING}/settle`, { marketId, outcome });
    const record = { marketId, outcome, payout: settled.payout, ts: Date.now() };
    results.push(record);
    console.log(`\x1b[35m[settlement-svc]\x1b[0m resolved ${marketId} → ${outcome}, paid out $${(settled.payout / 100).toFixed(2)}`);
    return send(res, 200, record);
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => banner('settlement-svc', PORT, 'settlement'));
