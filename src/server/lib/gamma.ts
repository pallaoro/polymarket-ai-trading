/**
 * Polymarket Gamma API client. Gamma is the public, read-only market-data
 * endpoint — no API key, no wallet. Returns active, unresolved markets.
 * Docs: https://docs.polymarket.com/api-reference/introduction
 */

const GAMMA = "https://gamma-api.polymarket.com";

export interface GammaMarket {
  id?: string | number;
  question?: string;
  slug?: string;
  outcomePrices?: string | string[];
  volume?: string | number;
  volumeNum?: string | number;
  volume24hr?: string | number;
  liquidity?: string | number;
  liquidityNum?: string | number;
  spread?: string | number;
  description?: string;
  endDate?: string;
  active?: boolean;
  closed?: boolean;
}

export interface GammaParams {
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
  [key: string]: unknown;
}

/** Fetch active, open markets from Gamma, sorted by 24h volume server-side. */
export async function fetchGammaMarkets(params: GammaParams = {}): Promise<GammaMarket[]> {
  const { signal, ...rest } = params;
  const search = new URLSearchParams({
    limit: String(rest.limit ?? 200),
    active: "true",
    closed: "false",
    order: "volume24hr",
    ascending: "false",
  });
  for (const [k, v] of Object.entries(rest)) {
    if (k === "limit") continue;
    if (v != null) search.set(k, String(v));
  }
  const res = await fetch(`${GAMMA}/markets?${search}`, { signal });
  if (!res.ok) throw new Error(`Gamma API ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
  const json = await res.json();
  return Array.isArray(json) ? (json as GammaMarket[]) : [];
}

/** Fetch a single market by id (used to re-price open positions). */
export async function fetchGammaMarket(id: string, signal?: AbortSignal): Promise<GammaMarket | null> {
  const res = await fetch(`${GAMMA}/markets/${encodeURIComponent(id)}`, { signal });
  if (!res.ok) return null;
  const json = await res.json().catch(() => null);
  return json && typeof json === "object" ? (json as GammaMarket) : null;
}

/** Parse Gamma's `outcomePrices` (JSON-string or array) into [yes, no]. */
export function parseOutcomePrices(m: GammaMarket): [number | null, number | null] {
  let p: unknown = m.outcomePrices ?? "[]";
  if (typeof p === "string") {
    try {
      p = JSON.parse(p);
    } catch {
      p = [];
    }
  }
  if (!Array.isArray(p) || p.length < 1) return [null, null];
  const yes = parseFloat(String(p[0]));
  const no = p.length >= 2 ? parseFloat(String(p[1])) : null;
  return [Number.isFinite(yes) ? yes : null, no != null && Number.isFinite(no) ? no : null];
}

export function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
}
