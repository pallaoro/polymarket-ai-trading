import { useCallback, useEffect, useState } from "react";
import { Play, RefreshCw, Settings2, Sliders, TrendingUp } from "lucide-react";
import type { Market, Settings, Signal, Stats, Trade } from "../shared/types";
import { api } from "./lib/api";
import { Button, Card, Zone, Stat, Badge, Chip, Spinner } from "./components/ui";
import { SignalsTable, PositionsTable, HistoryTable, MarketsTable } from "./components/tables";
import { SettingsPanel } from "./components/settings-panel";
import { AnalyzeDialog, type AnalyzeTarget } from "./components/analyze-dialog";
import { usd, signedUsd, pnlTone, pct } from "./lib/format";

type Toast = { msg: string; tone: "ok" | "err" };

export function App() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [positions, setPositions] = useState<Trade[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [aiAvailable, setAiAvailable] = useState(false);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<null | "cycle" | "mark">(null);
  const [closing, setClosing] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [analyze, setAnalyze] = useState<AnalyzeTarget | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const notify = (msg: string, tone: "ok" | "err" = "ok") => {
    setToast({ msg, tone });
    setTimeout(() => setToast(null), 4000);
  };

  const refreshLedger = useCallback(async () => {
    const [s, p, t] = await Promise.all([api.stats(), api.positions(), api.trades()]);
    setStats(s);
    setPositions(p);
    setTrades(t);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const health = (await fetch("/api/health").then((r) => r.json())) as { ai?: boolean };
      setAiAvailable(Boolean(health.ai));
      const [s, cfg, sig, pos, tr, mk] = await Promise.all([
        api.stats(),
        api.settings(),
        api.signals().catch(() => []),
        api.positions(),
        api.trades(),
        api.markets(40).catch(() => []),
      ]);
      setStats(s);
      setSettings(cfg);
      setSignals(sig);
      setPositions(pos);
      setTrades(tr);
      setMarkets(mk);
    } catch (e) {
      notify((e as Error).message, "err");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const runCycle = async () => {
    setBusy("cycle");
    try {
      const { result } = await api.cycle();
      const [sig] = await Promise.all([api.signals().catch(() => signals), refreshLedger()]);
      setSignals(sig);
      notify(
        result.opened > 0
          ? `Opened ${result.opened} position${result.opened > 1 ? "s" : ""} · scanned ${result.scanned} markets.`
          : `No trades opened · ${result.signals} signals, ${result.skipped} skipped.`,
      );
    } catch (e) {
      notify((e as Error).message, "err");
    } finally {
      setBusy(null);
    }
  };

  const markToMarket = async () => {
    setBusy("mark");
    try {
      const { result } = await api.mark();
      await refreshLedger();
      notify(`Re-priced ${result.repriced} · settled ${result.settled}.`);
    } catch (e) {
      notify((e as Error).message, "err");
    } finally {
      setBusy(null);
    }
  };

  const closePosition = async (id: number) => {
    setClosing(id);
    try {
      await api.closePosition(id);
      await refreshLedger();
      notify("Position closed.");
    } catch (e) {
      notify((e as Error).message, "err");
    } finally {
      setClosing(null);
    }
  };

  const saveSettings = async (patch: Partial<Settings>) => {
    const next = await api.saveSettings(patch);
    setSettings(next);
    setStats((s) => (s ? { ...s, bankroll: next.bankroll, mode: next.mode } : s));
    setSignals(await api.signals().catch(() => signals));
    notify("Strategy saved.");
  };

  const resetPaper = async () => {
    if (!confirm("Wipe the paper ledger and reset bankroll?")) return;
    try {
      await api.reset(settings?.bankroll);
      await Promise.all([refreshLedger(), api.signals().then(setSignals).catch(() => {})]);
      notify("Paper ledger reset.");
    } catch (e) {
      notify((e as Error).message, "err");
    }
  };

  const equity = stats ? stats.bankroll + stats.openExposure + stats.unrealizedPnl : 0;

  return (
    <div className="min-h-full">
      {/* Toolbar */}
      <header className="sticky top-0 z-40 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-3 px-5 py-3">
          <div className="flex items-center gap-2.5">
            <TrendingUp size={18} className="text-primary" />
            <h1 className="text-[20px] font-bold tracking-[-0.01em]">Polymarket AI Trader</h1>
            {stats && <Badge tone={stats.mode === "paper" ? "neutral" : "warning"}>{stats.mode === "paper" ? "PAPER" : "LIVE"}</Badge>}
            <Chip>{aiAvailable ? "AI on" : "AI off"}</Chip>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={resetPaper} title="Reset paper ledger"><Sliders size={14} /></Button>
            <Button variant="ghost" onClick={() => setShowSettings(true)} title="Strategy settings"><Settings2 size={14} /> Strategy</Button>
            <Button variant="secondary" onClick={markToMarket} disabled={busy !== null}>
              {busy === "mark" ? <Spinner /> : <RefreshCw size={14} />} Mark to market
            </Button>
            <Button variant="primary" onClick={runCycle} disabled={busy !== null}>
              {busy === "cycle" ? <Spinner /> : <Play size={14} />} Run cycle
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] space-y-4 px-5 py-5">
        {loading && !stats ? (
          <div className="flex items-center justify-center gap-2 py-20 text-muted"><Spinner /> Loading the desk…</div>
        ) : (
          <>
            {/* KPI row */}
            {stats && (
              <Card>
                <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-3 lg:grid-cols-6 lg:divide-y-0">
                  <Stat label="Equity" value={usd(equity)} meta="bankroll + positions" />
                  <Stat label="Cash" value={usd(stats.bankroll)} meta="available to deploy" />
                  <Stat label="Open P&L" value={<span className={pnlTone(stats.unrealizedPnl)}>{signedUsd(stats.unrealizedPnl)}</span>} meta={`${stats.openCount} open · ${usd(stats.openExposure)}`} />
                  <Stat label="Realized P&L" value={<span className={pnlTone(stats.realizedPnl)}>{signedUsd(stats.realizedPnl)}</span>} meta={`${stats.closedCount} closed`} />
                  <Stat label="Win rate" value={pct(stats.winRate)} meta={`${stats.closedCount} settled`} />
                  <Stat label="Signals" value={signals.length} meta="live opportunities" />
                </div>
              </Card>
            )}

            {/* Signals */}
            <Card>
              <Zone eyebrow="Signals" count={signals.length} first action={<span className="text-[11px] text-muted">mean-reversion · refreshed each cycle</span>}>
                <SignalsTable signals={signals} onAnalyze={(s) => setAnalyze({ question: s.question, yes: s.side === "YES" ? s.price : 1 - s.price })} />
              </Zone>
            </Card>

            {/* Open positions */}
            <Card>
              <Zone eyebrow="Open positions" count={positions.length} first>
                <PositionsTable positions={positions} onClose={closePosition} closing={closing} />
              </Zone>
            </Card>

            {/* History */}
            <Card>
              <Zone eyebrow="Trade history" count={trades.filter((t) => t.status === "closed").length} first>
                <HistoryTable trades={trades} />
              </Zone>
            </Card>

            {/* Top markets */}
            <Card>
              <Zone eyebrow="Top markets by quality" count={markets.length} first>
                <MarketsTable markets={markets} onAnalyze={(m) => setAnalyze({ question: m.question, yes: m.yes })} />
              </Zone>
            </Card>

            <p className="px-1 pb-6 text-center text-[11px] text-faint">
              Paper trading only. Market data from the public Polymarket Gamma API. Not financial advice.
            </p>
          </>
        )}
      </main>

      {showSettings && settings && (
        <SettingsPanel settings={settings} aiAvailable={aiAvailable} onSave={saveSettings} onClose={() => setShowSettings(false)} />
      )}
      {analyze && <AnalyzeDialog target={analyze} onClose={() => setAnalyze(null)} />}

      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
          <div className={`rounded-md border px-4 py-2.5 text-[13px] shadow-[0_8px_24px_rgba(0,0,0,0.16)] ${toast.tone === "err" ? "border-[var(--color-danger)] bg-danger-tint text-danger" : "border-border bg-surface text-foreground"}`}>
            {toast.msg}
          </div>
        </div>
      )}
    </div>
  );
}
