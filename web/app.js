// Front-end: renders the market board, drives the live microservice chips from
// /api/health, and shows the real request-flow for every action in the activity
// feed. With ?demo=1 it auto-plays a polished sequence for screen recordings.
const board = document.getElementById('board');
const feed = document.getElementById('feed');
const toastEl = document.getElementById('toast');
const last = {};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path, opts) { return (await fetch(path, opts)).json(); }
function toast(msg) { toastEl.textContent = msg; toastEl.classList.add('show'); setTimeout(() => toastEl.classList.remove('show'), 1900); }

// light up a service chip in the system lane
function ping(name) {
  const el = document.querySelector(`.svc[data-svc="${name}"]`);
  if (!el) return;
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 900);
}

function logActivity(method, route, services, result) {
  const li = document.createElement('li');
  li.innerHTML =
    `<div class="path">${method} ${route}</div>` +
    `<div class="meta"><span>${services.join('  →  ')}</span><span class="ok">${result}</span></div>`;
  feed.prepend(li);
  while (feed.children.length > 7) feed.lastChild.remove();
}

function card(m) {
  const moved = last[m.id] !== undefined && last[m.id] !== m.yes;
  last[m.id] = m.yes;
  const resolved = m.resolved
    ? `<div class="resolved">✓ Resolved — ${m.outcome === 'YES' ? m.home + ' won' : m.away + ' / draw'}</div>` : '';
  return `
  <div class="card" id="c-${m.id}">
    <div class="crow">
      <div>
        <div class="teams"><span class="flag">${m.hf}</span> ${m.home} <span class="vs">vs</span> ${m.away} <span class="flag">${m.af}</span></div>
        <div class="grp">${m.group}</div>
      </div>
      <div class="vol">Vol<br>${m.volume.toLocaleString()}</div>
    </div>
    <div class="bar"><span style="width:${m.yes}%"></span></div>
    <div class="btns">
      <button class="btn yes ${moved ? 'bump' : ''}" onclick="bet('${m.id}','YES')">BUY YES<span class="pct">${m.yes}¢</span></button>
      <button class="btn no" onclick="bet('${m.id}','NO')">BUY NO<span class="pct">${m.no}¢</span></button>
    </div>${resolved}
  </div>`;
}

async function render() {
  const markets = await api('/api/markets');
  board.innerHTML = markets.map(card).join('');
}

async function health() {
  try {
    const h = await api('/api/health');
    for (const s of ['markets', 'trading', 'settlement']) {
      document.querySelector(`.svc[data-svc="${s}"]`)?.classList.toggle('up', !!h[s]);
    }
    document.querySelector('.gw')?.classList.add('up');
  } catch {}
}

async function bet(marketId, side, shares = 30) {
  ping('trading'); setTimeout(() => ping('markets'), 220);     // visualize the hop
  const res = await api('/api/orders', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ marketId, side, shares }),
  });
  const fill = res.order;
  logActivity('POST', '/orders', res.trace || ['gateway', 'trading-svc', 'markets-svc'], `${fill.priceAt}¢`);
  toast(`Filled · ${shares} ${side} @ ${fill.priceAt}¢`);
  const c = document.getElementById('c-' + marketId);
  if (c) { c.classList.add('flash'); setTimeout(() => c.classList.remove('flash'), 650); }
  await render();
}
window.bet = bet;

// ── scripted auto-play for screen recordings (visit /?demo=1) ──
async function autoplay() {
  await sleep(1400);
  toast('⚽ Brazil to win — buying YES');
  await sleep(700); await bet('bra-srb', 'YES', 30);
  await sleep(1500); await bet('bra-srb', 'YES', 30);
  await sleep(1400); await bet('arg-mex', 'YES', 25);
  await sleep(1600);
  ping('settlement');
  toast('Full-time — settling Brazil v Serbia');
  await sleep(700);
  await api('/api/results', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ marketId: 'bra-srb', outcome: 'YES' }) });
  logActivity('POST', '/results', ['gateway', 'settlement-svc', 'trading-svc'], 'paid out');
  await render();
  await sleep(700); toast('Winners paid ✓');
}

render(); health();
setInterval(render, 1600); setInterval(health, 3000);
if (new URLSearchParams(location.search).get('demo') === '1') autoplay();
