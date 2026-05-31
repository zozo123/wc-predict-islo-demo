// trading-svc — accepts YES/NO orders, books positions, and asks markets-svc
// to move the price. Holds the user's portfolio in memory.
const http = require('http');
const { send, readJson, call, banner } = require('../../lib/http');

const PORT = process.env.TRADING_PORT || 4002;
const MARKETS = process.env.MARKETS_URL || 'http://localhost:4001';

const positions = []; // { id, marketId, side, shares, priceAt, ts }
let seq = 1;

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/positions')
    return send(res, 200, positions);

  if (req.method === 'POST' && url.pathname === '/orders') {
    const { marketId, side, shares } = await readJson(req);
    const n = Math.max(1, Number(shares) || 0);
    if (!marketId || (side !== 'YES' && side !== 'NO'))
      return send(res, 400, { error: 'marketId and side (YES|NO) required' });

    // Move the market, then record the fill at the resulting price.
    const market = await call('POST', `${MARKETS}/markets/${marketId}/trade`, { side, shares: n });
    const priceAt = side === 'YES' ? market.yes : market.no;
    const pos = { id: seq++, marketId, side, shares: n, priceAt, ts: Date.now() };
    positions.push(pos);
    console.log(`\x1b[33m[trading-svc]\x1b[0m fill #${pos.id} ${side} ${n} ${marketId} @ ${priceAt}¢`);
    return send(res, 200, { order: pos, market });
  }

  // Settlement calls this to pay out positions on a resolved market.
  if (req.method === 'POST' && url.pathname === '/settle') {
    const { marketId, outcome } = await readJson(req);
    let payout = 0;
    for (const p of positions.filter((x) => x.marketId === marketId)) {
      if (p.side === outcome) payout += p.shares * 100; // each winning share pays $1.00
    }
    return send(res, 200, { marketId, outcome, payout });
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => banner('trading-svc', PORT, 'trading'));
