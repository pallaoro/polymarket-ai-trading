import { Hono } from "hono";
import { initDB } from "./db";
import { ensureSettings } from "./lib/store";
import { fetchGammaMarkets } from "./lib/gamma";
import { toMarket } from "./lib/quality";
import { findSignals } from "./lib/signals";
import { analyzeMarket } from "./lib/ai";
import { getSettings, updateSettings, getStats, listTrades, listOpenTrades } from "./lib/store";
import { runCycle, markToMarket, closeTrade, resetPaper } from "./lib/engine";
import type { Settings } from "../shared/types";

type Env = {
  Bindings: {
    DB: D1Database;
    OPENROUTER_API_KEY?: string;
    POLYMARKET_MODEL?: string;
    RELAYER_API_KEY?: string;
    RELAYER_API_KEY_ADDRESS?: string;
  };
};

const app = new Hono<Env>();

// Surface real error messages instead of Hono's opaque 500 so the dashboard
// toast (and logs) say what actually failed.
app.onError((err, c) => {
  console.error("[api error]", err);
  const message = err instanceof Error ? err.message : String(err);
  return c.json({ error: message }, 500);
});

// The tables come from src/server/schema.sql, applied by the Clawnify build
// pipeline on deploy (and by the `dev` script locally). Here we just bind the
// DB and make sure the single settings row exists.
app.use("*", async (c, next) => {
  initDB(c.env);
  await ensureSettings();
  await next();
});

function envOf(c: { env: Env["Bindings"] }): Record<string, string | undefined> {
  return c.env as unknown as Record<string, string | undefined>;
}

// ── Read endpoints ───────────────────────────────────────────────────

app.get("/api/health", async (c) => {
  const stats = await getStats();
  return c.json({ status: "ok", ai: Boolean(c.env.OPENROUTER_API_KEY), ...stats });
});

app.get("/api/stats", async (c) => c.json(await getStats()));

app.get("/api/settings", async (c) => c.json(await getSettings()));

app.put("/api/settings", async (c) => {
  const patch = await c.req.json<Partial<Settings>>().catch(() => ({}));
  return c.json(await updateSettings(patch));
});

app.get("/api/markets", async (c) => {
  const limit = Math.min(200, Math.max(1, Number(c.req.query("limit")) || 60));
  const raw = await fetchGammaMarkets({ limit });
  const markets = raw
    .map(toMarket)
    .filter((m) => m.yes != null)
    .sort((a, b) => b.quality.total - a.quality.total);
  return c.json({ markets });
});

app.get("/api/signals", async (c) => {
  const cfg = await getSettings();
  const raw = await fetchGammaMarkets({ limit: 200 });
  return c.json({ signals: findSignals(raw, cfg) });
});

app.get("/api/trades", async (c) => {
  const limit = Number(c.req.query("limit")) || 200;
  return c.json({ trades: await listTrades(limit) });
});

app.get("/api/positions", async (c) => c.json({ positions: await listOpenTrades() }));

// ── Actions ──────────────────────────────────────────────────────────

app.post("/api/cycle", async (c) => {
  const result = await runCycle(envOf(c));
  const stats = await getStats();
  return c.json({ result, stats });
});

app.post("/api/mark", async (c) => {
  const result = await markToMarket();
  const stats = await getStats();
  return c.json({ result, stats });
});

app.post("/api/positions/:id/close", async (c) => {
  const id = Number(c.req.param("id"));
  const trade = await closeTrade(id);
  if (!trade) return c.json({ error: "Position not found or already closed." }, 404);
  return c.json({ trade, stats: await getStats() });
});

app.post("/api/analyze", async (c) => {
  const { question, yesPrice } = await c.req.json<{ question: string; yesPrice?: number | null }>();
  if (!question) return c.json({ error: "question is required" }, 400);
  return c.json(await analyzeMarket(envOf(c), question, yesPrice ?? null));
});

app.post("/api/reset", async (c) => {
  const { bankroll } = await c.req.json<{ bankroll?: number }>().catch(() => ({}) as { bankroll?: number });
  await resetPaper(bankroll && bankroll > 0 ? bankroll : 1000);
  return c.json({ ok: true, stats: await getStats() });
});

export default app;
