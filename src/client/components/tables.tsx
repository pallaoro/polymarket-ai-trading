import { ExternalLink, Sparkles, X } from "lucide-react";
import type { Signal, Trade, Market } from "../../shared/types";
import { Button, Empty, GradeBadge, SideBadge, Chip } from "./ui";
import { usd, signedUsd, cents, pnlTone, ago, compactUsd } from "../lib/format";

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`bg-surface-sunken px-3 py-2.5 text-[12px] font-semibold tracking-[0.04em] text-muted ${right ? "text-right" : "text-left"}`}
    >
      {children}
    </th>
  );
}

function Td({ children, right, className }: { children?: React.ReactNode; right?: boolean; className?: string }) {
  return (
    <td className={`px-3 py-2.5 align-middle ${right ? "text-right tnum" : ""} ${className || ""}`}>{children}</td>
  );
}

function marketLink(slug: string) {
  return slug ? `https://polymarket.com/event/${slug}` : "https://polymarket.com";
}

function Question({ q, slug }: { q: string; slug: string }) {
  return (
    <a
      href={marketLink(slug)}
      target="_blank"
      rel="noreferrer"
      className="group inline-flex items-start gap-1 text-foreground hover:text-link"
    >
      <span className="line-clamp-2 max-w-[28rem]">{q}</span>
      <ExternalLink size={12} className="mt-0.5 shrink-0 text-faint opacity-0 transition-opacity group-hover:opacity-100" />
    </a>
  );
}

export function SignalsTable({ signals, onAnalyze }: { signals: Signal[]; onAnalyze: (s: Signal) => void }) {
  if (!signals.length) return <Empty>No signals right now. Markets are fairly priced — check back after the next cycle.</Empty>;
  return (
    <div className="-mx-5 -mb-4 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <Th>Market</Th>
            <Th>Trade</Th>
            <Th right>Price</Th>
            <Th right>24h vol</Th>
            <Th>Quality</Th>
            <Th right>Reason</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {signals.map((s) => (
            <tr key={s.marketId} className="border-t border-border hover:bg-surface-sunken">
              <Td><Question q={s.question} slug={s.slug} /></Td>
              <Td><SideBadge side={s.side} /></Td>
              <Td right>{cents(s.price)}</Td>
              <Td right>{compactUsd(s.quality.volume24h)}</Td>
              <Td><GradeBadge quality={s.quality} /></Td>
              <Td><span className="text-[12px] text-muted">{s.reason}</span></Td>
              <Td right>
                <Button variant="ghost" onClick={() => onAnalyze(s)} title="AI analysis" className="h-7 px-2">
                  <Sparkles size={13} /> Analyze
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PositionsTable({ positions, onClose, closing }: { positions: Trade[]; onClose: (id: number) => void; closing: number | null }) {
  if (!positions.length) return <Empty>No open positions. Run a cycle to let the strategy open paper trades.</Empty>;
  const totalPnl = positions.reduce((s, t) => s + t.pnl, 0);
  return (
    <div className="-mx-5 -mb-4 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <Th>Market</Th>
            <Th>Side</Th>
            <Th right>Entry</Th>
            <Th right>Now</Th>
            <Th right>Size</Th>
            <Th right>Conf.</Th>
            <Th right>P&L</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {positions.map((t) => (
            <tr key={t.id} className="border-t border-border hover:bg-surface-sunken">
              <Td><Question q={t.question} slug="" /></Td>
              <Td><SideBadge side={t.side} /></Td>
              <Td right>{cents(t.entryPrice)}</Td>
              <Td right>{cents(t.currentPrice)}</Td>
              <Td right>{usd(t.sizeUsd)}</Td>
              <Td right>{t.aiConfidence == null ? "—" : `${Math.round(t.aiConfidence * 100)}%`}</Td>
              <Td right className={pnlTone(t.pnl)}>{signedUsd(t.pnl)}</Td>
              <Td right>
                <Button variant="ghost" onClick={() => onClose(t.id)} disabled={closing === t.id} title="Close position" className="h-7 px-2">
                  <X size={13} /> Close
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border">
            <Td className="text-[12px] text-muted">{positions.length} open</Td>
            <Td /><Td /><Td /><Td /><Td right><span className="text-[12px] text-muted">Total</span></Td>
            <Td right className={pnlTone(totalPnl)}>{signedUsd(totalPnl)}</Td>
            <Td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function HistoryTable({ trades }: { trades: Trade[] }) {
  const closed = trades.filter((t) => t.status === "closed");
  if (!closed.length) return <Empty>No closed trades yet. Positions settle when their market resolves, or when you close them.</Empty>;
  const realized = closed.reduce((s, t) => s + t.pnl, 0);
  return (
    <div className="-mx-5 -mb-4 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <Th>Market</Th>
            <Th>Side</Th>
            <Th right>Entry</Th>
            <Th right>Exit</Th>
            <Th right>Size</Th>
            <Th right>P&L</Th>
            <Th right>Closed</Th>
          </tr>
        </thead>
        <tbody>
          {closed.map((t) => (
            <tr key={t.id} className="border-t border-border hover:bg-surface-sunken">
              <Td><Question q={t.question} slug="" /></Td>
              <Td><SideBadge side={t.side} /></Td>
              <Td right>{cents(t.entryPrice)}</Td>
              <Td right>{cents(t.exitPrice)}</Td>
              <Td right>{usd(t.sizeUsd)}</Td>
              <Td right className={pnlTone(t.pnl)}>{signedUsd(t.pnl)}</Td>
              <Td right><span className="text-[12px] text-muted">{ago(t.closedAt)}</span></Td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-border">
            <Td className="text-[12px] text-muted">{closed.length} closed</Td>
            <Td /><Td /><Td /><Td right><span className="text-[12px] text-muted">Realized</span></Td>
            <Td right className={pnlTone(realized)}>{signedUsd(realized)}</Td>
            <Td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

export function MarketsTable({ markets, onAnalyze }: { markets: Market[]; onAnalyze: (m: Market) => void }) {
  if (!markets.length) return <Empty>Couldn't load markets. The Polymarket Gamma API may be rate-limiting — try again.</Empty>;
  return (
    <div className="-mx-5 -mb-4 overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <Th>Market</Th>
            <Th right>YES</Th>
            <Th right>Volume</Th>
            <Th>Quality</Th>
            <Th />
          </tr>
        </thead>
        <tbody>
          {markets.map((m) => (
            <tr key={m.id} className="border-t border-border hover:bg-surface-sunken">
              <Td><Question q={m.question} slug={m.slug} /></Td>
              <Td right>{cents(m.yes)}</Td>
              <Td right>{compactUsd(m.volume)}</Td>
              <Td>
                <div className="flex items-center gap-1.5">
                  <GradeBadge quality={m.quality} />
                  {m.quality.volume24h > 0 && <Chip>{compactUsd(m.quality.volume24h)}/24h</Chip>}
                </div>
              </Td>
              <Td right>
                <Button variant="ghost" onClick={() => onAnalyze(m)} className="h-7 px-2">
                  <Sparkles size={13} /> Analyze
                </Button>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
