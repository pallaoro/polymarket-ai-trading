import { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import { api, type Analysis } from "../lib/api";
import { Badge, Button, Spinner, Zone } from "./ui";
import { cents } from "../lib/format";

export interface AnalyzeTarget {
  question: string;
  yes: number | null;
}

export function AnalyzeDialog({ target, onClose }: { target: AnalyzeTarget; onClose: () => void }) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setAnalysis(null);
    setError(null);
    api
      .analyze(target.question, target.yes)
      .then((a) => live && setAnalysis(a))
      .catch((e) => live && setError(e.message));
    return () => {
      live = false;
    };
  }, [target.question, target.yes]);

  const tone =
    analysis?.recommendation === "avoid" ? "warning" : analysis?.recommendation ? "success" : "neutral";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-lg border border-border bg-surface shadow-[0_8px_24px_rgba(0,0,0,0.16)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-primary" />
            <h2 className="text-[16px] font-semibold">AI market analysis</h2>
          </div>
          <Button variant="ghost" onClick={onClose} className="h-8 w-8 px-0"><X size={16} /></Button>
        </div>

        <Zone eyebrow="Market" first action={<span className="tnum text-[13px] text-muted">{cents(target.yes)} YES</span>}>
          <p className="text-[14px] leading-snug text-foreground">{target.question}</p>
        </Zone>

        <Zone eyebrow="Verdict">
          {error ? (
            <p className="text-[13px] text-danger">{error}</p>
          ) : !analysis ? (
            <div className="flex items-center gap-2 text-[13px] text-muted"><Spinner /> Asking the model…</div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge tone={tone}>{analysis.recommendation.toUpperCase()}</Badge>
                <span className="tnum text-[13px] text-muted">{Math.round(analysis.confidence * 100)}% confidence</span>
                {analysis.fairValue != null && (
                  <span className="tnum text-[13px] text-muted">· fair value {cents(analysis.fairValue)}</span>
                )}
              </div>
              <p className="text-[13px] leading-relaxed text-foreground">{analysis.rationale}</p>
            </div>
          )}
        </Zone>
      </div>
    </div>
  );
}
