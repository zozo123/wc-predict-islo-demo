// markets-svc — owns the market book: World Cup match markets and their
// live LMSR prices. Other services read prices here and apply trades/resolution.
const http = require('http');
const { send, readJson, banner } = require('../../lib/http');

const PORT = process.env.MARKETS_PORT || 4001;
const B = 200; // LMSR liquidity parameter — higher = less price impact per share.

// Sample fixtures for the demo: these pairings and groups are from the 2022
// World Cup group stage, not a real or upcoming schedule.
// Each market is a binary "will the home team win?" outcome. q tracks net shares.
// Initial q values are tuned so the board opens at realistic, varied odds and a
// ~25-share bet visibly nudges the price ~3¢ (great for the on-camera tick).
const markets = [
  m('bra-srb', 'Brazil', 'Serbia', '🇧🇷', '🇷🇸', 'Group G', 49, -49, 1240),   // ~62¢
  m('arg-mex', 'Argentina', 'Mexico', '🇦🇷', '🇲🇽', 'Group C', 90, -89, 980),  // ~71¢
  m('fra-den', 'France', 'Denmark', '🇫🇷', '🇩🇰', 'Group D', 20, -20, 610),     // ~55¢
  m('eng-usa', 'England', 'USA', '🏴', '🇺🇸', 'Group B', 0, 0, 430),            // ~50¢
  m('esp-ger', 'Spain', 'Germany', '🇪🇸', '🇩🇪', 'Group E', 32, -32, 720),      // ~58¢
  m('por-uru', 'Portugal', 'Uruguay', '🇵🇹', '🇺🇾', 'Group H', -24, 24, 360),   // ~44¢
];

function m(id, home, away, hf, af, group, qYes, qNo, volume) {
  return { id, home, away, hf, af, group, qYes, qNo, volume: volume || 0, resolved: false, outcome: null };
}

// LMSR: price of YES = e^(qYes/B) / (e^(qYes/B) + e^(qNo/B)).
function priceYes(mk) {
  const a = Math.exp(mk.qYes / B);
  const b = Math.exp(mk.qNo / B);
  return a / (a + b);
}

function view(mk) {
  const p = priceYes(mk);
  return {
    id: mk.id, home: mk.home, away: mk.away, hf: mk.hf, af: mk.af, group: mk.group,
    yes: Math.round(p * 100), no: Math.round((1 - p) * 100),
    volume: mk.volume, resolved: mk.resolved, outcome: mk.outcome,
  };
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204, '');
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'GET' && url.pathname === '/health') return send(res, 200, { ok: true, svc: 'markets-svc' });
  const parts = url.pathname.split('/').filter(Boolean); // e.g. ['markets', 'bra-srb', 'trade']

  if (req.method === 'GET' && url.pathname === '/markets')
    return send(res, 200, markets.map(view));

  if (parts[0] === 'markets' && parts[1]) {
    const mk = markets.find((x) => x.id === parts[1]);
    if (!mk) return send(res, 404, { error: 'no such market' });

    if (req.method === 'GET' && !parts[2]) return send(res, 200, view(mk));

    // Apply a trade (called by trading-svc). Buying YES pushes qYes up → price up.
    if (req.method === 'POST' && parts[2] === 'trade') {
      const { side, shares } = await readJson(req);
      const n = Math.max(1, Number(shares) || 0);
      if (side === 'YES') mk.qYes += n; else mk.qNo += n;
      mk.volume += n;
      return send(res, 200, view(mk));
    }

    // Resolve a market (called by settlement-svc).
    if (req.method === 'POST' && parts[2] === 'resolve') {
      const { outcome } = await readJson(req); // 'YES' | 'NO'
      mk.resolved = true;
      mk.outcome = outcome;
      return send(res, 200, view(mk));
    }
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, () => banner('markets-svc', PORT, 'markets'));
