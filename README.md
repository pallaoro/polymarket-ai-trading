# Polymarket AI Trader — Open-Source Prediction-Market Trading Bot

[![Deploy with Clawnify](https://app.clawnify.com/deploy-button.svg)](https://app.clawnify.com/deploy?repo=pallaoro/polymarket-ai-trading)

An **open-source, self-hostable AI trading bot for [Polymarket](https://polymarket.com)** prediction markets. It pulls live markets from Polymarket's public **Gamma API**, scores market quality, generates **mean-reversion** signals (longshot-bias and favorite-fade), gates each idea through an LLM "risk desk," sizes positions with the **Kelly criterion**, and tracks a full **paper-trading** P&L ledger — built on **React + Hono + Cloudflare Workers + D1** and deployable in one click via [Clawnify](https://clawnify.com).

> **Paper-trading by default — no wallet key, no real money, nothing to drain.** Most "Polymarket trading bot" repos ask you to paste a funded wallet private key into unaudited code. This one doesn't: it simulates against live prices, and live CLOB execution stays disabled behind an explicit, auditable seam. Trade the strategy, not your savings.

Use it as a research desk for **algorithmic prediction-market trading**, a quant sandbox for **mean reversion and Kelly sizing**, or a starting point for your own Polymarket strategy.

## Start here — pick your path

| If you want to… | Do this |
|---|---|
| **Deploy a hosted version in one click** | Click **[Deploy with Clawnify](https://app.clawnify.com/deploy?repo=pallaoro/polymarket-ai-trading)** — your AI employee provisions it, wires the API keys, and gives you a live dashboard. No server, no Docker. |
| **Run it locally** | `pnpm install && pnpm dev` → dashboard on `localhost:5173`. See [Local development](#local-development). |
| **Understand the strategy** | Read [How it works](#how-it-works) — quality scoring, signals, AI gating, Kelly sizing. |
| **Take it live (advanced)** | Read [Going live](#going-live-the-execution-seam) before flipping anything. Live trading is intentionally stubbed. |

## Features

- **Live Polymarket markets** — pulled from the public **Gamma API** (`gamma-api.polymarket.com`); no API key, no wallet, read-only.
- **Market quality scoring (0–100, A–F)** — ranks markets by liquidity, spread tightness, 24h activity, and clarity, so the bot only trades deep, unambiguous markets.
- **Mean-reversion signals** — two well-documented prediction-market edges: cheap-**longshot** value buys and **favorite-fade** (buy the underpriced NO on rich favorites). Thresholds fully configurable.
- **AI gating** — a skeptical LLM "risk desk" approves or rejects every signal with a calibrated confidence, via **OpenRouter** (use any model: Claude, GPT, Gemini, Llama).
- **Fractional-Kelly position sizing** — optimal-growth sizing scaled down for noisy edges, with hard per-position and total-exposure caps.
- **Paper-trading ledger** — open positions, mark-to-market, automatic settlement on resolution, realized/unrealized P&L, and win rate, persisted in **D1 (SQLite)**.
- **One-click AI market analysis** — ask the model for fair value and a recommendation on any market.
- **Agent-ready** — every action is an API route the Clawnify perimeter exposes to your AI employee, so an agent can run cycles, mark to market, and report P&L on a schedule.

## How it works

```
Polymarket Gamma API (live markets)
        │
        ▼
 Quality scoring  ──►  only A/B markets (deep, tight, active, clear)
        │
        ▼
 Mean-reversion signals  ──►  longshot YES  ·  favorite-fade NO
        │
        ▼
 AI risk-desk gate (OpenRouter)  ──►  take? + calibrated confidence
        │
        ▼
 Fractional-Kelly sizing  ──►  caps: per-position · total exposure · kill switch
        │
        ▼
 Executor (paper | live)  ──►  fill recorded in the D1 ledger
        │
        ▼
 Mark-to-market + settle on resolution  ──►  realized / unrealized P&L
```

The strategy concepts — favorite-longshot bias, mean reversion, Kelly sizing, market-quality filtering — come from decades of prediction-market and sports-betting research. The point isn't a guaranteed edge (there isn't one); it's a clean, legible framework you can study, tune, and extend.

## Stack

**React + Vite + Tailwind CSS** dashboard · **Hono** API on **Cloudflare Workers** · **D1 (SQLite)** ledger via `@clawnify/db` · **OpenRouter** for AI · public **Polymarket Gamma API** for data. Deploys to Workers for Platforms through [Clawnify](https://clawnify.com); no separate database, queue, or VM to run.

## Configuration

Secrets are injected by the Clawnify platform (added via the dashboard or CLI — **never** in `clawnify.json` or source).

| Env | Required | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | for AI features | LLM gating + market analysis; the quant strategy runs without it |
| `POLYMARKET_MODEL` | optional | OpenRouter model id (default `anthropic/claude-sonnet-4`) |
| `RELAYER_API_KEY` | yes | Polymarket relayer key for (future) live execution |
| `RELAYER_API_KEY_ADDRESS` | yes | Wallet address paired with the relayer key |

Strategy parameters — bankroll, Kelly fraction, position/exposure caps, signal thresholds, AI gating, kill switch — live in the in-app **Strategy** panel and persist to D1.

## API

All routes sit behind the Clawnify perimeter (your dashboard and your AI employee reach them with injected identity).

| Method | Path | Does |
|---|---|---|
| `GET` | `/api/markets?limit=` | live, quality-scored markets |
| `GET` | `/api/signals` | current mean-reversion signals |
| `GET` | `/api/stats` · `/api/positions` · `/api/trades` | portfolio + ledger |
| `GET` · `PUT` | `/api/settings` | strategy configuration |
| `POST` | `/api/cycle` | run one paper-trading cycle |
| `POST` | `/api/mark` | mark open positions to market + settle resolved |
| `POST` | `/api/positions/:id/close` | manually close a position |
| `POST` | `/api/analyze` | AI fair-value analysis of a market |
| `POST` | `/api/reset` | wipe the paper ledger |

## Going live (the execution seam)

Everything runs in **paper** mode. All execution flows through a single `Executor` interface (`src/server/lib/executor.ts`):

- `PaperExecutor` fills instantly at the quoted price — no money moves.
- `LiveExecutor` is a **guarded stub**. It refuses to run without `RELAYER_API_KEY` + `RELAYER_API_KEY_ADDRESS` and explicit live mode, and throws until the Polymarket CLOB relayer integration is implemented **and audited**. Switching a deployment to real trading is a change in one file — not a rewrite of the strategy — and is left as a deliberate, reviewable step.

**This is not financial advice.** Prediction-market trading is risky; you can lose money. Paper-trade first, understand the strategy, and never run any trading bot against a wallet you can't afford to lose.

## Local development

```bash
pnpm install
pnpm dev          # applies schema.sql to a local D1, runs Vite + Wrangler
```

Vite serves the dashboard on `:5173` and proxies `/api` to Wrangler on `:8787`. For AI features locally, add `OPENROUTER_API_KEY` to a gitignored `.dev.vars`. Requires **Node ≥ 22**.

---

*Open-source Polymarket trading bot · AI prediction-market trading · paper trading · mean reversion · Kelly criterion · quant research. For research and simulation — not financial advice.*
