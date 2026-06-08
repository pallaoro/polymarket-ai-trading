/**
 * Fractional-Kelly position sizing. The Kelly criterion maximizes long-run
 * log-growth of bankroll; full Kelly is too aggressive for noisy edges, so we
 * scale it by `kellyFraction` (default 0.25) and clamp to a hard per-position
 * cap. AI confidence (0-1) nudges the effective edge. Ported from `trader.mjs`.
 */

export function kellySize(
  edgePct: number,
  price: number,
  bankroll: number,
  kellyFraction: number,
  maxPositionUsd: number,
  aiConfidence = 0.5,
): number {
  if (price <= 0 || price >= 1) return 0;
  if (bankroll <= 0) return 0;

  // Payout odds: a $1 stake at `price` returns (1-price)/price on win.
  const b = (1 - price) / price;

  // Estimated win probability from edge, blended with AI confidence.
  const edgeP = 0.5 + edgePct / 200; // edge of 20 → p ≈ 0.6
  const p = Math.max(0.01, Math.min(0.99, edgeP * 0.6 + aiConfidence * 0.4));
  const q = 1 - p;

  // Kelly fraction of bankroll: f* = (b·p − q) / b
  const f = (b * p - q) / b;
  if (f <= 0) return 0;

  const stake = bankroll * f * kellyFraction;
  return Math.max(0, Math.min(stake, maxPositionUsd));
}
