/** Types shared between the worker and the dashboard. */

export type Side = "YES" | "NO";
export type TradeStatus = "open" | "closed";
export type TradingMode = "paper" | "live";

/** A market quality score (0-100) with its component breakdown. */
export interface Quality {
  total: number;
  grade: "A" | "B" | "C" | "D" | "F";
  liquidity: number;
  spread: number;
  activity: number;
  clarity: number;
  volume24h: number;
}

/** A live Polymarket market, normalized and quality-scored. */
export interface Market {
  id: string;
  question: string;
  slug: string;
  yes: number | null;
  no: number | null;
  volume: number;
  liquidity: number;
  endDate: string | null;
  quality: Quality;
}

/** A mean-reversion trade idea derived from a market's prices. */
export interface Signal {
  marketId: string;
  question: string;
  slug: string;
  side: Side;
  price: number;
  edge: number;
  reason: string;
  volume: number;
  quality: Quality;
}

/** A row in the paper-trade ledger. */
export interface Trade {
  id: number;
  mode: TradingMode;
  marketId: string;
  question: string;
  side: Side;
  entryPrice: number;
  sizeUsd: number;
  shares: number;
  status: TradeStatus;
  pnl: number;
  exitPrice: number | null;
  currentPrice: number | null;
  aiConfidence: number | null;
  reason: string;
  openedAt: string;
  closedAt: string | null;
}

/** Per-org strategy + safety configuration (single row). */
export interface Settings {
  mode: TradingMode;
  bankroll: number;
  kellyFraction: number;
  maxPositions: number;
  maxPositionUsd: number;
  maxExposureUsd: number;
  minVolumeUsd: number;
  favoriteThreshold: number;
  longshotMin: number;
  longshotMax: number;
  aiGating: boolean;
  killSwitch: boolean;
}

/** Portfolio rollup for the dashboard KPI row. */
export interface Stats {
  bankroll: number;
  openCount: number;
  closedCount: number;
  openExposure: number;
  unrealizedPnl: number;
  realizedPnl: number;
  winRate: number;
  mode: TradingMode;
}
