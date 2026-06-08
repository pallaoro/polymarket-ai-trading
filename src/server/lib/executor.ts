/**
 * Execution seam. The engine never talks to an exchange directly — it asks an
 * Executor to fill an order. This is the single place where "paper" vs "live"
 * diverges, so flipping a customer from simulation to real Polymarket CLOB
 * orders is a config change, not a rewrite of the strategy.
 *
 *   PaperExecutor — fills instantly at the quoted price. No money moves.
 *   LiveExecutor  — places real on-chain CLOB orders. Guarded: refuses to run
 *                   unless a wallet is configured AND live mode is explicitly
 *                   enabled, and is intentionally a stub here. See TODO below
 *                   before enabling it in production.
 */
import type { Side, TradingMode } from "../../shared/types";

export interface OrderRequest {
  marketId: string;
  side: Side;
  /** Quoted price (0-1) the signal fired at. */
  price: number;
  sizeUsd: number;
}

export interface Fill {
  /** Actual fill price (0-1). For paper this equals the quote. */
  price: number;
  shares: number;
}

export interface Executor {
  readonly mode: TradingMode;
  buy(req: OrderRequest): Promise<Fill>;
  sell(marketId: string, side: Side, shares: number, price: number): Promise<Fill>;
}

class PaperExecutor implements Executor {
  readonly mode = "paper" as const;

  async buy(req: OrderRequest): Promise<Fill> {
    if (req.price <= 0 || req.price >= 1) throw new Error(`Invalid price ${req.price}`);
    return { price: req.price, shares: req.sizeUsd / req.price };
  }

  async sell(_marketId: string, _side: Side, shares: number, price: number): Promise<Fill> {
    return { price, shares };
  }
}

class LiveExecutor implements Executor {
  readonly mode = "live" as const;

  constructor(private env: Record<string, string | undefined>) {}

  private guard(): never {
    // TODO(live-trading): implement against the Polymarket CLOB via the relayer
    //   (https://docs.polymarket.com — CLOB / orders). Requirements:
    //   1. RELAYER_API_KEY + RELAYER_API_KEY_ADDRESS held as Worker secrets,
    //      injected by the platform (declared required in clawnify.json). Never
    //      in the DB, client, or source.
    //   2. Build + EIP-712 sign the order, then submit through the relayer so
    //      fills are gasless (no raw Polygon private key in the Worker).
    //   3. Re-check the kill switch and per-day loss cap before every order.
    //   4. Resolve the CLOB tokenId for the chosen side (not available via
    //      Gamma alone).
    // Until that is built + audited, live execution is refused at the seam so
    // no real money can move by accident.
    throw new Error("Live trading is not enabled in this build. Keep mode=paper.");
  }

  async buy(_req: OrderRequest): Promise<Fill> {
    if (!this.env.RELAYER_API_KEY || !this.env.RELAYER_API_KEY_ADDRESS) {
      throw new Error("Live trading requires RELAYER_API_KEY and RELAYER_API_KEY_ADDRESS secrets.");
    }
    return this.guard();
  }

  async sell(): Promise<Fill> {
    return this.guard();
  }
}

export function getExecutor(mode: TradingMode, env: Record<string, string | undefined>): Executor {
  return mode === "live" ? new LiveExecutor(env) : new PaperExecutor();
}
