// Front-end: renders the market board, places orders through the gateway, and
// (when loaded with ?demo=1) auto-plays a scripted bet so the action animates
// itself on camera — no click-scripting needed inside the terminal browser.
const board = document.getElementById('board');
const toastEl = document.getElementById('toast');
const last = {}; // id -> last YES pct, to detect ticks

async function api(path, opts) {
  const r = await fetch(path, opts);
  return r.json();
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  setTimeout(() => toastEl.classList.remove('show'), 1900);
}

function card(m) {
  const moved = last[m.id] !== undefined && last[m.id] !== m.yes;
  last[m.id] = m.yes;
  const resolved = m.resolved
    ? `<div class="resolved">✔ Resolved — ${m.outcome === 'YES' ? m.home + ' won' : m.away + ' / draw'}</div>`
    : '';
  return `
  <div class="card" id="c-${m.id}">
    <div class="match">
      <div>
        <div class="teams"><span class="flag">${m.hf}</span> ${m.home} <span class="group">v</span> ${m.away} <span class="flag">${m.af}</span></div>
        <div class="group">${m.group}</div>
      </div>
      <div class="vol">Vol ${m.volume.toLocaleString()}</div>
    </div>
    <div class="prices">
      <button class="btn buyyes ${moved ? 'bump' : ''}" onclick="bet('${m.id}','YES')">BUY YES<span class="pct">${m.yes}¢</span></button>
      <button class="btn buyno" onclick="bet('${m.id}','NO')">BUY NO<span class="pct">${m.no}¢</span></button>
    </div>
    ${resolved}
  </div>`;
}

async function render() {
  const markets = await api('/api/markets');
  board.innerHTML = markets.map(card).join('');
}

async function bet(marketId, side, shares = 25) {
  const res = await api('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ marketId, side, shares }),
  });
  const fill = res.order;
  toast(`Filled · ${shares} ${side} @ ${fill.priceAt}¢`);
  const c = document.getElementById('c-' + marketId);
  if (c) { c.classList.add('flash'); setTimeout(() => c.classList.remove('flash'), 600); }
  await render();
}
window.bet = bet;

// ---- scripted auto-play for the movie (visit /?demo=1) ----
async function autoplay() {
  await sleep(1200);
  toast('⚽ Brazil to win — buying YES');
  await sleep(900);
  await bet('bra-srb', 'YES', 25); // price ticks up
  await sleep(1600);
  await bet('bra-srb', 'YES', 25); // again — clear visible move
  await sleep(1800);
  toast('Final score in — settling market');
  await sleep(900);
  await api('/api/results', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ marketId: 'bra-srb', outcome: 'YES' }),
  });
  await render();
  await sleep(800);
  toast('Paid out ✔');
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

render();
setInterval(render, 1500);
if (new URLSearchParams(location.search).get('demo') === '1') autoplay();
