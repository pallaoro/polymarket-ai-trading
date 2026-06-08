/**
 * Mean-reversion signal detection. Two well-documented edges on prediction
 * markets (see the source repo's research/ notes):
 *
 *   1. Longshot bias — outcomes priced 5-20% are systematically overpriced by
 *      crowds chasing big payouts, but here we treat a cheap YES as a value buy
 *      when it clears the floor (configurable). Ported as `longshot` YES.
 *   2. Favorite fade — when YES trades very rich (>75%), buying the cheap NO
 *      side captures reversion if the favorite slips.
 *
 * Pure function of a market + thresholds. No I/O.
 */
import { num, type GammaMarket } from "./gamma";
import { toMarket } from "./quality";
import type { Settings, Signal, Side } from "../../shared/types";

function priceFor(m: GammaMarket, side: Side): number | null {
  const market = toMarket(m);
  return side === "YES" ? market.yes : market.no;
}

export function findSignal(m: GammaMarket, cfg: Settings): Signal | null {
  const vol = num(m.volume ?? m.volumeNum);
  if (vol < cfg.minVolumeUsd) return null;

  const market = toMarket(m);
  const yes = market.yes;
  if (yes == null || yes <= 0 || yes >= 1) return null;

  let side: Side | null = null;
  let price = 0;
  let edge = 0;
  let reason = "";

  if (yes >= cfg.longshotMin && yes <= cfg.longshotMax) {
    side = "YES";
    price = yes;
    edge = 20;
    reason = `Longshot YES at ${(yes * 100).toFixed(0)}% — mean-reversion value`;
  } else if (yes > cfg.favoriteThreshold) {
    const no = priceFor(m, "NO");
    if (no != null && no >= 0.05) {
      side = "NO";
      price = no;
      edge = 15;
      reason = `Favorite at ${(yes * 100).toFixed(0)}% — fade by buying NO`;
    }
  }

  if (!side) return null;

  return {
    marketId: market.id,
    question: market.question,
    slug: market.slug,
    side,
    price,
    edge,
    reason,
    volume: vol,
    quality: market.quality,
  };
}

/** Scan a batch of markets for signals, best (highest quality) first. */
export function findSignals(markets: GammaMarket[], cfg: Settings): Signal[] {
  const out: Signal[] = [];
  for (const m of markets) {
    const sig = findSignal(m, cfg);
    if (sig) out.push(sig);
  }
  out.sort((a, b) => b.quality.total - a.quality.total);
  return out;
}
