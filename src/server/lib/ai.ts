/**
 * AI gating + analysis for trade ideas. Uses OpenRouter with the org's
 * injected OPENROUTER_API_KEY (the platform standard); the model is
 * overridable via POLYMARKET_MODEL. The model acts as a skeptical risk desk:
 * it reads the market question and the proposed mean-reversion trade and
 * decides whether to take it, with a calibrated confidence.
 */
import type { Signal } from "../../shared/types";

const DEFAULT_MODEL = "anthropic/claude-sonnet-4";

export interface Gate {
  take: boolean;
  confidence: number; // 0-1
  rationale: string;
}

export interface Analysis {
  recommendation: "yes" | "no" | "avoid";
  confidence: number;
  fairValue: number | null;
  rationale: string;
}

function modelOf(env: Record<string, string | undefined>): string {
  return env.POLYMARKET_MODEL || DEFAULT_MODEL;
}

async function openrouterJSON(
  env: Record<string, string | undefined>,
  system: string,
  user: string,
): Promise<Record<string, unknown>> {
  const apiKey = env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("AI unavailable: OPENROUTER_API_KEY is not set.");
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://clawnify.com",
      "X-Title": "Polymarket AI Trader",
    },
    body: JSON.stringify({
      model: modelOf(env),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouter error ${res.status}: ${text.slice(0, 300)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content || "{}";
  const cleaned = content.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const a = cleaned.indexOf("{");
    const b = cleaned.lastIndexOf("}");
    return a >= 0 && b > a ? JSON.parse(cleaned.slice(a, b + 1)) : {};
  }
}

const GATE_SYSTEM = `You are a disciplined prediction-market risk desk. A quant signal proposes a mean-reversion trade on a Polymarket market. Decide whether to TAKE it.

Be skeptical: most longshots are cheap for good reasons, and favorites are often correctly priced. Only take trades where the crowd is plausibly mispricing the outcome. Account for resolution risk and ambiguity.

Respond with ONLY a JSON object, no prose, no code fences:
{ "take": boolean, "confidence": number (0-1, your calibrated probability the trade is +EV), "rationale": string (one sentence) }`;

export async function gateSignal(env: Record<string, string | undefined>, sig: Signal): Promise<Gate> {
  const user = [
    `Market: ${sig.question}`,
    `Proposed trade: BUY ${sig.side} at ${(sig.price * 100).toFixed(1)}¢`,
    `Signal rationale: ${sig.reason}`,
    `Market quality: grade ${sig.quality.grade} (${sig.quality.total}/100), 24h volume $${Math.round(sig.quality.volume24h).toLocaleString()}`,
  ].join("\n");
  const j = await openrouterJSON(env, GATE_SYSTEM, user);
  const confidence = clamp01(Number(j.confidence));
  return {
    take: Boolean(j.take),
    confidence: Number.isFinite(confidence) ? confidence : 0.5,
    rationale: String(j.rationale ?? "").slice(0, 280),
  };
}

const ANALYZE_SYSTEM = `You are a prediction-market analyst. Given a Polymarket market question and the current YES price, assess fair value and give a recommendation.

Respond with ONLY a JSON object, no prose, no code fences:
{ "recommendation": "yes" | "no" | "avoid", "confidence": number (0-1), "fairValue": number (0-1, your estimate of the true YES probability) or null, "rationale": string (2-3 sentences) }`;

export async function analyzeMarket(
  env: Record<string, string | undefined>,
  question: string,
  yesPrice: number | null,
): Promise<Analysis> {
  const user = [
    `Market: ${question}`,
    yesPrice != null ? `Current YES price: ${(yesPrice * 100).toFixed(1)}¢` : `Current YES price: unknown`,
  ].join("\n");
  const j = await openrouterJSON(env, ANALYZE_SYSTEM, user);
  const rec = String(j.recommendation ?? "avoid").toLowerCase();
  const fair = j.fairValue == null ? null : clamp01(Number(j.fairValue));
  return {
    recommendation: rec === "yes" || rec === "no" ? (rec as "yes" | "no") : "avoid",
    confidence: clamp01(Number(j.confidence)) || 0.5,
    fairValue: fair != null && Number.isFinite(fair) ? fair : null,
    rationale: String(j.rationale ?? "").slice(0, 600),
  };
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}
