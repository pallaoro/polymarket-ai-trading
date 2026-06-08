import type { Market, Signal, Trade, Settings, Stats } from "../../shared/types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data as T;
}

export interface Analysis {
  recommendation: "yes" | "no" | "avoid";
  confidence: number;
  fairValue: number | null;
  rationale: string;
}

export interface CycleResult {
  scanned: number;
  signals: number;
  opened: number;
  skipped: number;
  notes: string[];
}

export const api = {
  stats: () => req<Stats>("/api/stats"),
  settings: () => req<Settings>("/api/settings"),
  saveSettings: (patch: Partial<Settings>) =>
    req<Settings>("/api/settings", { method: "PUT", body: JSON.stringify(patch) }),
  markets: (limit = 60) => req<{ markets: Market[] }>(`/api/markets?limit=${limit}`).then((r) => r.markets),
  signals: () => req<{ signals: Signal[] }>("/api/signals").then((r) => r.signals),
  trades: (limit = 200) => req<{ trades: Trade[] }>(`/api/trades?limit=${limit}`).then((r) => r.trades),
  positions: () => req<{ positions: Trade[] }>("/api/positions").then((r) => r.positions),
  cycle: () => req<{ result: CycleResult; stats: Stats }>("/api/cycle", { method: "POST" }),
  mark: () => req<{ result: { repriced: number; settled: number }; stats: Stats }>("/api/mark", { method: "POST" }),
  closePosition: (id: number) =>
    req<{ trade: Trade; stats: Stats }>(`/api/positions/${id}/close`, { method: "POST" }),
  analyze: (question: string, yesPrice: number | null) =>
    req<Analysis>("/api/analyze", { method: "POST", body: JSON.stringify({ question, yesPrice }) }),
  reset: (bankroll?: number) =>
    req<{ ok: true; stats: Stats }>("/api/reset", { method: "POST", body: JSON.stringify({ bankroll }) }),
};
