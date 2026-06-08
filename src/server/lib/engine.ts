/**
 * The trading loop, as discrete server-triggered steps (the source repo ran an
 * infinite setInterval; on Workers we expose one cycle per request so it can be
 * driven by the dashboard button, an agent, or a scheduler).
 *
 *   runCycle      — scan live markets, gate ideas, size with Kelly, open fills.
 *   markToMarket  — re-price open positions; settle ones whose market resolved.
 *   closeTrade    — manually exit a position at the current price.
 */
import { query, get, run } from "../db";
import { fetchGammaMarkets, fetchGammaMarket, parseOutcomePrices } from "./gamma";
import { toMarket } from "./quality";
import { findSignals } from "./signals";
import { kellySize } from "./kelly";
import { gateSignal } from "./ai";
import { getExecutor } from "./executor";
import { getSettings, round } from "./store";
import type { Side, Trade } from "../../shared/types";

const MAX_OPENS_PER_CYCLE = 3;

export interface CycleResult {
  scanned: number;
  signals: number;
  opened: number;
  skipped: number;
  notes: string[];
}

export async function runCycle(env: Record<string, string | undefined>): Promise<CycleResult> {
  const cfg = await getSettings();
  const notes: string[] = [];
  if (cfg.killSwitch) return { scanned: 0, signals: 0, opened: 0, skipped: 0, notes: ["Kill switch is on — no trades opened."] };

  const raw = await fetchGammaMarkets({ limit: 200 });
  const signals = findSignals(raw, cfg);

  const openRows = await query<{ market_id: string; size_usd: number }>(
    "SELECT market_id, size_usd FROM trades WHERE status = 'open'",
  );
  const heldMarkets = new Set(openRows.map((r) => r.market_id));
  let exposure = openRows.reduce((s, r) => s + r.size_usd, 0);
  let openCount = openRows.length;
  let bankroll = cfg.bankroll;

  const executor = getExecutor(cfg.mode, env);
  const aiActive = cfg.aiGating && Boolean(env.OPENROUTER_API_KEY);

  let opened = 0;
  let skipped = 0;

  for (const sig of signals) {
    if (opened >= MAX_OPENS_PER_CYCLE) break;
    if (openCount >= cfg.maxPositions) {
      notes.push("Reached max open positions.");
      break;
    }
    if (heldMarkets.has(sig.marketId)) {
      skipped++;
      continue;
    }

    let confidence = 0.5;
    if (aiActive) {
      try {
        const gate = await gateSignal(env, sig);
        if (!gate.take) {
          skipped++;
          continue;
        }
        confidence = gate.confidence;
      } catch (e) {
        notes.push(`AI gate failed, skipping ${sig.marketId}: ${(e as Error).message}`);
        skipped++;
        continue;
      }
    }

    const size = kellySize(sig.edge, sig.price, bankroll, cfg.kellyFraction, cfg.maxPositionUsd, confidence);
    if (size <= 0) {
      skipped++;
      continue;
    }
    if (size > bankroll) break;
    if (exposure + size > cfg.maxExposureUsd) {
      notes.push("Reached max exposure cap.");
      break;
    }

    const fill = await executor.buy({ marketId: sig.marketId, side: sig.side, price: sig.price, sizeUsd: size });

    await run(
      `INSERT INTO trades (mode, market_id, question, slug, side, entry_price, size_usd, shares, status, current_price, ai_confidence, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)`,
      [
        cfg.mode,
        sig.marketId,
        sig.question,
        sig.slug,
        sig.side,
        fill.price,
        round(size),
        fill.shares,
        fill.price,
        aiActive ? confidence : null,
        sig.reason,
      ],
    );

    bankroll = round(bankroll - size);
    exposure += size;
    openCount++;
    heldMarkets.add(sig.marketId);
    opened++;
  }

  if (opened > 0) await run("UPDATE settings SET bankroll = ? WHERE id = 1", [bankroll]);

  return { scanned: raw.length, signals: signals.length, opened, skipped, notes };
}

/** PnL on an open/closed long position bought at `entry` for `shares`. */
function positionPnl(shares: number, entry: number, price: number): number {
  return round(shares * (price - entry));
}

export interface MarkResult {
  repriced: number;
  settled: number;
}

export async function markToMarket(): Promise<MarkResult> {
  const open = await query<{
    id: number;
    market_id: string;
    side: string;
    entry_price: number;
    shares: number;
    size_usd: number;
  }>("SELECT id, market_id, side, entry_price, shares, size_usd FROM trades WHERE status = 'open'");
  if (!open.length) return { repriced: 0, settled: 0 };

  // One batch fetch covers actively-traded markets; resolved ones drop out of
  // the active set and are fetched individually to detect settlement.
  const live = await fetchGammaMarkets({ limit: 500 });
  const byId = new Map(live.map((m) => [String(m.id ?? ""), m]));

  let repriced = 0;
  let settled = 0;

  for (const t of open) {
    const side = t.side as Side;
    let market = byId.get(t.market_id) || null;
    if (!market) market = await fetchGammaMarket(t.market_id);
    if (!market) continue;

    const m = toMarket(market);
    const price = side === "YES" ? m.yes : m.no;
    if (price == null) continue;

    const resolved = market.closed === true || price <= 0.001 || price >= 0.999;
    if (resolved) {
      const exit = price >= 0.5 ? (price >= 0.999 ? 1 : price) : (price <= 0.001 ? 0 : price);
      const pnl = positionPnl(t.shares, t.entry_price, exit);
      await run(
        "UPDATE trades SET status = 'closed', exit_price = ?, current_price = ?, pnl = ?, closed_at = datetime('now') WHERE id = ?",
        [exit, exit, pnl, t.id],
      );
      // Return realized proceeds to bankroll (capital + winnings/losses).
      await run("UPDATE settings SET bankroll = bankroll + ? WHERE id = 1", [round(t.shares * exit)]);
      settled++;
    } else {
      await run("UPDATE trades SET current_price = ?, pnl = ? WHERE id = ?", [
        price,
        positionPnl(t.shares, t.entry_price, price),
        t.id,
      ]);
      repriced++;
    }
  }

  return { repriced, settled };
}

/** Manually exit one open position at its last/looked-up price. */
export async function closeTrade(id: number): Promise<Trade | null> {
  const t = await get<{
    market_id: string;
    side: string;
    entry_price: number;
    shares: number;
    current_price: number | null;
    status: string;
  }>("SELECT market_id, side, entry_price, shares, current_price, status FROM trades WHERE id = ?", [id]);
  if (!t || t.status !== "open") return null;

  let price = t.current_price;
  if (price == null) {
    const market = await fetchGammaMarket(t.market_id);
    if (market) {
      const [yes, no] = parseOutcomePrices(market);
      price = t.side === "YES" ? yes : no;
    }
  }
  if (price == null) price = t.entry_price; // last resort: flat

  const pnl = positionPnl(t.shares, t.entry_price, price);
  await run(
    "UPDATE trades SET status = 'closed', exit_price = ?, current_price = ?, pnl = ?, closed_at = datetime('now') WHERE id = ?",
    [price, price, pnl, id],
  );
  await run("UPDATE settings SET bankroll = bankroll + ? WHERE id = 1", [round(t.shares * price)]);

  return get<Trade>("SELECT * FROM trades WHERE id = ?", [id]) as Promise<Trade | null>;
}

/** Wipe the ledger and restore bankroll to a clean slate. */
export async function resetPaper(bankroll = 1000): Promise<void> {
  await run("DELETE FROM trades", []);
  await run("UPDATE settings SET bankroll = ? WHERE id = 1", [bankroll]);
}
