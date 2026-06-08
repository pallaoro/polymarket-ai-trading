/**
 * Market quality scoring. A 0-100 score from liquidity, spread tightness,
 * recent activity, and description clarity — ported from the source repo's
 * `quality.mjs`. High-quality markets are the only ones worth trading: deep,
 * tight, active, and unambiguous.
 */
import { parseOutcomePrices, num, type GammaMarket } from "./gamma";
import type { Quality, Market } from "../../shared/types";

function gradeFromScore(total: number): Quality["grade"] {
  if (total >= 80) return "A";
  if (total >= 65) return "B";
  if (total >= 50) return "C";
  if (total >= 35) return "D";
  return "F";
}

export function scoreMarket(m: GammaMarket): Quality {
  const vol = num(m.volume ?? m.volumeNum);
  const vol24 = num(m.volume24hr);
  const spread = num(m.spread);
  const liquidity = num(m.liquidity ?? m.liquidityNum);

  const liquidityScore = Math.min(35, (Math.log10(vol + 1) / 7) * 35);
  const spreadScore = Math.max(0, 25 - spread * 500);
  const activityScore = Math.min(15, (Math.log10(vol24 + 1) / 6) * 15);
  const descLen = (m.description || m.question || "").length;
  const clarityScore = Math.min(25, 8 + Math.min(17, descLen / 200));

  const total = Math.min(100, liquidityScore + spreadScore + activityScore + clarityScore);
  const round = (n: number) => Math.round(n * 10) / 10;

  return {
    total: round(total),
    grade: gradeFromScore(total),
    liquidity: round(liquidityScore),
    spread: round(spreadScore),
    activity: round(activityScore),
    clarity: round(clarityScore),
    volume24h: vol24,
  };
}

/** Normalize + quality-score a raw Gamma market for the dashboard / engine. */
export function toMarket(m: GammaMarket): Market {
  const [yes, no] = parseOutcomePrices(m);
  return {
    id: String(m.id ?? ""),
    question: m.question || "",
    slug: m.slug || "",
    yes,
    no,
    volume: num(m.volume ?? m.volumeNum),
    liquidity: num(m.liquidity ?? m.liquidityNum),
    endDate: m.endDate || null,
    quality: scoreMarket(m),
  };
}
