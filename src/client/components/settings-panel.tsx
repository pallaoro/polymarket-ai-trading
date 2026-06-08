import { useState } from "react";
import { X } from "lucide-react";
import type { Settings } from "../../shared/types";
import { Button, Zone, Badge } from "./ui";

const FIELDS: { key: keyof Settings; label: string; step?: number; min?: number; max?: number; hint?: string }[] = [
  { key: "bankroll", label: "Bankroll (USD)", step: 50, min: 0, hint: "Simulated capital" },
  { key: "kellyFraction", label: "Kelly fraction", step: 0.05, min: 0, max: 1, hint: "Fraction of full Kelly" },
  { key: "maxPositions", label: "Max open positions", step: 1, min: 1 },
  { key: "maxPositionUsd", label: "Max per position (USD)", step: 25, min: 1 },
  { key: "maxExposureUsd", label: "Max total exposure (USD)", step: 50, min: 1 },
  { key: "minVolumeUsd", label: "Min market volume (USD)", step: 1000, min: 0 },
  { key: "favoriteThreshold", label: "Favorite threshold", step: 0.05, min: 0.5, max: 1, hint: "Fade YES above this" },
  { key: "longshotMin", label: "Longshot min", step: 0.01, min: 0, max: 0.5 },
  { key: "longshotMax", label: "Longshot max", step: 0.01, min: 0, max: 0.5 },
];

export function SettingsPanel({
  settings,
  aiAvailable,
  onSave,
  onClose,
}: {
  settings: Settings;
  aiAvailable: boolean;
  onSave: (patch: Partial<Settings>) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Settings, v: number | boolean | string) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    setSaving(true);
    try {
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface px-5 py-3">
          <h2 className="text-[20px] font-bold tracking-[-0.01em]">Strategy</h2>
          <Button variant="ghost" onClick={onClose} className="h-8 w-8 px-0"><X size={16} /></Button>
        </div>

        <Zone eyebrow="Execution mode" first>
          <div className="flex items-center gap-2">
            {(["paper", "live"] as const).map((m) => (
              <button
                key={m}
                onClick={() => set("mode", m)}
                disabled={m === "live"}
                title={m === "live" ? "Live trading is not enabled in this build" : ""}
                className={`h-9 flex-1 rounded-sm border text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  draft.mode === m ? "border-transparent bg-primary text-on-primary" : "border-border bg-surface text-foreground hover:bg-surface-sunken"
                }`}
              >
                {m === "paper" ? "Paper (simulated)" : "Live"}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Paper trades never touch real money. Live execution against the Polymarket CLOB is stubbed behind a wallet
            secret — see <code className="text-foreground">executor.ts</code>.
          </p>
        </Zone>

        <Zone eyebrow="AI gating">
          <label className="flex items-center justify-between">
            <span className="text-[13px]">Require AI approval per trade</span>
            <input
              type="checkbox"
              checked={draft.aiGating}
              disabled={!aiAvailable}
              onChange={(e) => set("aiGating", e.target.checked)}
              className="h-4 w-4 accent-[var(--color-primary)]"
            />
          </label>
          {!aiAvailable && (
            <p className="mt-2 text-[11px] text-warning">Connect OPENROUTER_API_KEY to enable AI gating.</p>
          )}
        </Zone>

        <Zone eyebrow="Risk &amp; sizing">
          <div className="grid grid-cols-2 gap-3">
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="text-[12px] font-semibold tracking-[0.04em] text-muted">{f.label}</span>
                <input
                  type="number"
                  value={draft[f.key] as number}
                  step={f.step}
                  min={f.min}
                  max={f.max}
                  onChange={(e) => set(f.key, parseFloat(e.target.value) || 0)}
                  className="tnum mt-1 h-9 w-full rounded-sm border border-border bg-surface px-2.5 text-[13px] focus:border-ring focus:outline-none"
                />
                {f.hint && <span className="text-[11px] text-faint">{f.hint}</span>}
              </label>
            ))}
          </div>
        </Zone>

        <Zone eyebrow="Safety">
          <label className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[13px]">Kill switch {draft.killSwitch && <Badge tone="danger">ON</Badge>}</span>
            <input
              type="checkbox"
              checked={draft.killSwitch}
              onChange={(e) => set("killSwitch", e.target.checked)}
              className="h-4 w-4 accent-[var(--color-danger)]"
            />
          </label>
          <p className="mt-2 text-[11px] text-muted">When on, cycles open no new positions.</p>
        </Zone>

        <div className="sticky bottom-0 flex justify-end gap-2 border-t border-border bg-surface px-5 py-3">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save strategy"}</Button>
        </div>
      </div>
    </div>
  );
}
