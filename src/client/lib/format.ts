export const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n >= 100 || n <= -100 ? 0 : 2 });

export const signedUsd = (n: number) => (n > 0 ? "+" : "") + usd(n);

export const cents = (p: number | null | undefined) => (p == null ? "—" : `${(p * 100).toFixed(1)}¢`);

export const pct = (n: number, digits = 0) => `${n.toFixed(digits)}%`;

export const compactUsd = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}k`;
  return `$${Math.round(n)}`;
};

export const ago = (iso: string | null) => {
  if (!iso) return "—";
  const t = Date.parse(iso.includes("T") ? iso : iso.replace(" ", "T") + "Z");
  if (Number.isNaN(t)) return "—";
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const pnlTone = (n: number) =>
  n > 0 ? "text-[var(--color-success)]" : n < 0 ? "text-[var(--color-danger)]" : "text-[var(--color-muted)]";
