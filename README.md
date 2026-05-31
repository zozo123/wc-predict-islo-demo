# ⚽ World Cup Prediction Market — built with Claude Code, run on islo

A Polymarket-style prediction market for World Cup matches, as **3 microservices + a gateway**.
Zero dependencies (Node built-ins only) — clone and `node start.js`.

This repo is the payload for an islo demo: **Claude Code (local) builds it; islo runs it in a
hardware-isolated sandbox** and exposes it with `islo share`.

## Architecture

```
browser ──▶ gateway :3000 ──┬─/api/markets──▶ markets-svc   :4001  (LMSR pricing)
                            ├─/api/orders ──▶ trading-svc   :4002  (orders + positions)
                            └─/api/results──▶ settlement-svc:4003  (resolve + payouts)
```

- **markets-svc** — the market book: six World Cup match markets, live LMSR prices.
- **trading-svc** — accepts YES/NO orders, moves the price via markets-svc, books positions.
- **settlement-svc** — ingests final scores, resolves markets, pays out winning positions.
- **gateway** — serves the web UI and proxies `/api/*` to the right service.

## Run locally

```bash
node start.js          # boots all three services + gateway
open http://localhost:3000
```

## Run on islo (the demo)

```bash
curl -fsSL https://islo.dev/install.sh | sh
islo login
islo use wc-predict -- node start.js     # clones this repo into a sandbox and boots it
islo share wc-predict 3000               # public URL — open it in any browser (even a terminal one)
```

Add `?demo=1` to the URL for a scripted auto-play (places a bet, ticks the odds, settles) —
handy for screen recordings.
