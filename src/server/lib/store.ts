/**
 * Row mapping + portfolio rollups over the trades/settings tables. Keeps SQL
 * in one place so routes and the engine read typed objects.
 */
import { query, get, run } from "../db";
import type { Settings, Trade, Stats, TradingMode } from "../../shared/types";

interface SettingsRow {
  mode: string;
  bankroll: number;
  kelly_fraction: number;
  max_positions: number;
  max_position_usd: number;
  max_exposure_usd: number;
  min_volume_usd: number;
  favorite_threshold: number;
  longshot_min: number;
  longshot_max: number;
  ai_gating: number;
  kill_switch: number;
}

interface TradeRow {
  id: number;
  mode: string;
  market_id: string;
  question: string;
  side: string;
  entry_price: number;
  size_usd: number;
  shares: number;
  status: string;
  pnl: number;
  exit_price: number | null;
  current_price: number | null;
  ai_confidence: number | null;
  reason: string;
  opened_at: string;
  closed_at: string | null;
}

export async function ensureSettings(): Promise<void> {
  await run(`INSERT OR IGNORE INTO settings (id) VALUES (1)`);
}

export async function getSettings(): Promise<Settings> {
  await ensureSettings();
  const r = await get<SettingsRow>("SELECT * FROM settings WHERE id = 1");
  return {
    mode: (r?.mode as TradingMode) || "paper",
    bankroll: r?.bankroll ?? 1000,
    kellyFraction: r?.kelly_fraction ?? 0.25,
    maxPositions: r?.max_positions ?? 10,
    maxPositionUsd: r?.max_position_usd ?? 100,
    maxExposureUsd: r?.max_exposure_usd ?? 600,
    minVolumeUsd: r?.min_volume_usd ?? 10000,
    favoriteThreshold: r?.favorite_threshold ?? 0.75,
    longshotMin: r?.longshot_min ?? 0.05,
    longshotMax: r?.longshot_max ?? 0.2,
    aiGating: (r?.ai_gating ?? 1) === 1,
    killSwitch: (r?.kill_switch ?? 0) === 1,
  };
}

const SETTING_COLUMNS: Record<keyof Settings, string> = {
  mode: "mode",
  bankroll: "bankroll",
  kellyFraction: "kelly_fraction",
  maxPositions: "max_positions",
  maxPositionUsd: "max_position_usd",
  maxExposureUsd: "max_exposure_usd",
  minVolumeUsd: "min_volume_usd",
  favoriteThreshold: "favorite_threshold",
  longshotMin: "longshot_min",
  longshotMax: "longshot_max",
  aiGating: "ai_gating",
  killSwitch: "kill_switch",
};

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  await ensureSettings();
  const sets: string[] = [];
  const vals: (string | number)[] = [];
  for (const [k, col] of Object.entries(SETTING_COLUMNS)) {
    const v = patch[k as keyof Settings];
    if (v === undefined) continue;
    sets.push(`${col} = ?`);
    vals.push(typeof v === "boolean" ? (v ? 1 : 0) : v);
  }
  if (sets.length) {
    await run(`UPDATE settings SET ${sets.join(", ")} WHERE id = 1`, vals);
  }
  return getSettings();
}

function mapTrade(r: TradeRow): Trade {
  return {
    id: r.id,
    mode: (r.mode as TradingMode) || "paper",
    marketId: r.market_id,
    question: r.question,
    side: r.side as Trade["side"],
    entryPrice: r.entry_price,
    sizeUsd: r.size_usd,
    shares: r.shares,
    status: r.status as Trade["status"],
    pnl: r.pnl,
    exitPrice: r.exit_price,
    currentPrice: r.current_price,
    aiConfidence: r.ai_confidence,
    reason: r.reason,
    openedAt: r.opened_at,
    closedAt: r.closed_at,
  };
}

export async function listTrades(limit = 200): Promise<Trade[]> {
  const rows = await query<TradeRow>(
    "SELECT * FROM trades ORDER BY opened_at DESC LIMIT ?",
    [Math.max(1, Math.min(500, limit))],
  );
  return rows.map(mapTrade);
}

export async function listOpenTrades(): Promise<Trade[]> {
  const rows = await query<TradeRow>("SELECT * FROM trades WHERE status = 'open' ORDER BY opened_at DESC");
  return rows.map(mapTrade);
}

export async function getStats(): Promise<Stats> {
  const settings = await getSettings();
  const rows = await query<TradeRow>("SELECT * FROM trades");
  const trades = rows.map(mapTrade);
  const open = trades.filter((t) => t.status === "open");
  const closed = trades.filter((t) => t.status === "closed");
  const wins = closed.filter((t) => t.pnl > 0).length;
  return {
    bankroll: settings.bankroll,
    openCount: open.length,
    closedCount: closed.length,
    openExposure: round(open.reduce((s, t) => s + t.sizeUsd, 0)),
    unrealizedPnl: round(open.reduce((s, t) => s + t.pnl, 0)),
    realizedPnl: round(closed.reduce((s, t) => s + t.pnl, 0)),
    winRate: closed.length ? round((wins / closed.length) * 100) : 0,
    mode: settings.mode,
  };
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}
