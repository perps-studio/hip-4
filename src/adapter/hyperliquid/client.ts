// ---------------------------------------------------------------------------
// Hyperliquid HIP-4 HTTP Client
//
// Wraps the HL info + exchange REST API. Outcome markets use the same
// endpoints as perps but with @<id> (outcome-level) and #<id><side>
// (per-side probability) coin prefixes.
// ---------------------------------------------------------------------------

import type {
  HLAllMids,
  HLCancelAction,
  HLCandle,
  HLClearinghouseState,
  HLExchangeResponse,
  HLFill,
  HLFrontendOrder,
  HLL2Book,
  HLOrderAction,
  HLOutcomeMeta,
  HLSignature,
  HLSpotClearinghouseState,
  HLTrade,
} from "./types";

// ---------------------------------------------------------------------------
// Typed API error - carries HTTP status for retry decisions
// ---------------------------------------------------------------------------

export class HLApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HLApiError";
  }
}

const MAINNET_INFO_URL = "https://api.hyperliquid.xyz/info";
const MAINNET_EXCHANGE_URL = "https://api.hyperliquid.xyz/exchange";
const TESTNET_INFO_URL = "https://api-ui.hyperliquid-testnet.xyz/info";
const TESTNET_EXCHANGE_URL = "https://api-ui.hyperliquid-testnet.xyz/exchange";

const TESTNET_WS_URL = "wss://api-ui.hyperliquid-testnet.xyz/ws";
const MAINNET_WS_URL = "wss://api.hyperliquid.xyz/ws";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

export interface HIP4ClientConfig {
  testnet?: boolean;
  infoUrl?: string;
  exchangeUrl?: string;
  /** Optional logger. Default: no-op. */
  logger?: (
    level: "debug" | "info" | "warn" | "error",
    msg: string,
    data?: unknown,
  ) => void;
}

// ---------------------------------------------------------------------------
// Coin-name helpers
// ---------------------------------------------------------------------------

/** Outcome-level coin name (AMM instrument) */
export function outcomeCoin(outcomeId: number): string {
  return `@${outcomeId}`;
}

/** Per-side probability coin name */
export function sideCoin(outcomeId: number, sideIndex: number): string {
  return `#${outcomeId}${sideIndex}`;
}

/** Asset ID for order placement: 100_000_000 + outcomeId * 10 + sideIndex */
export function sideAssetId(outcomeId: number, sideIndex: number): number {
  return 100_000_000 + outcomeId * 10 + sideIndex;
}

/** Parse a side coin like "#5160" or "+5160" into {outcomeId, sideIndex} */
export function parseSideCoin(coin: string): {
  outcomeId: number;
  sideIndex: number;
} | null {
  // HIP-4 uses # prefix, testnet may use + as an alternative
  if (!coin.startsWith("#") && !coin.startsWith("+")) return null;
  const num = coin.slice(1);
  if (num.length < 2) return null;
  const sideIndex = parseInt(num.slice(-1), 10);
  const outcomeId = parseInt(num.slice(0, -1), 10);
  if (isNaN(sideIndex) || isNaN(outcomeId)) return null;
  if (sideIndex > 1) return null;
  return { outcomeId, sideIndex };
}

/** Parse an outcome-level coin like "@1338" into {outcomeId} */
export function parseOutcomeCoin(coin: string): { outcomeId: number } | null {
  if (!coin.startsWith("@")) return null;
  const outcomeId = parseInt(coin.slice(1), 10);
  if (isNaN(outcomeId)) return null;
  return { outcomeId };
}

/** Extract the outcome ID from either @, #, or + coin format */
export function coinOutcomeId(coin: string): number | null {
  if (coin.startsWith("#") || coin.startsWith("+")) {
    const parsed = parseSideCoin(coin);
    return parsed ? parsed.outcomeId : null;
  }
  if (coin.startsWith("@")) {
    const parsed = parseOutcomeCoin(coin);
    return parsed ? parsed.outcomeId : null;
  }
  return null;
}

/** Check if a coin is an outcome-level or side-level instrument */
export function isOutcomeCoin(coin: string): boolean {
  return coin.startsWith("@") || coin.startsWith("#") || coin.startsWith("+");
}

// ---------------------------------------------------------------------------
// HIP4Client
// ---------------------------------------------------------------------------

export class HIP4Client {
  readonly infoUrl: string;
  readonly exchangeUrl: string;
  readonly wsUrl: string;
  readonly testnet: boolean;
  readonly log: (
    level: "debug" | "info" | "warn" | "error",
    msg: string,
    data?: unknown,
  ) => void;

  constructor(config: HIP4ClientConfig = {}) {
    this.testnet = config.testnet ?? true;
    this.infoUrl =
      config.infoUrl ?? (this.testnet ? TESTNET_INFO_URL : MAINNET_INFO_URL);
    this.exchangeUrl =
      config.exchangeUrl ??
      (this.testnet ? TESTNET_EXCHANGE_URL : MAINNET_EXCHANGE_URL);
    this.wsUrl = this.testnet ? TESTNET_WS_URL : MAINNET_WS_URL;
    this.log = config.logger ?? (() => {});
  }

  // -- Info endpoints -------------------------------------------------------

  async fetchOutcomeMeta(): Promise<HLOutcomeMeta> {
    return this.infoPost<HLOutcomeMeta>({ type: "outcomeMeta" });
  }

  async fetchL2Book(coin: string): Promise<HLL2Book> {
    return this.infoPost<HLL2Book>({ type: "l2Book", coin });
  }

  async fetchRecentTrades(coin: string): Promise<HLTrade[]> {
    return this.infoPost<HLTrade[]>({ type: "recentTrades", coin });
  }

  async fetchAllMids(): Promise<HLAllMids> {
    return this.infoPost<HLAllMids>({ type: "allMids" });
  }

  async fetchCandleSnapshot(
    coin: string,
    interval: string,
    startTime: number,
    endTime: number,
  ): Promise<HLCandle[]> {
    return this.infoPost<HLCandle[]>({
      type: "candleSnapshot",
      req: { coin, interval, startTime, endTime },
    });
  }

  async fetchClearinghouseState(user: string): Promise<HLClearinghouseState> {
    return this.infoPost<HLClearinghouseState>({
      type: "clearinghouseState",
      user,
    });
  }

  async fetchUserFills(user: string): Promise<HLFill[]> {
    return this.infoPost<HLFill[]>({ type: "userFills", user });
  }

  /** Spot meta + asset contexts (includes markPx / oracle price for each spot asset) */
  async fetchSpotAssetCtx(spotIndex: number): Promise<{ markPx: string; midPx: string } | null> {
    const data = await this.infoPost<[unknown, Array<{ markPx?: string; midPx?: string; coin?: string }>]>({
      type: "spotMetaAndAssetCtxs",
    });
    const ctx = data[1]?.[spotIndex];
    if (!ctx?.markPx) return null;
    return { markPx: ctx.markPx, midPx: ctx.midPx ?? "0" };
  }

  /** Spot balances - HIP-4 prediction market positions live here (USDH, outcome tokens) */
  async fetchSpotClearinghouseState(
    user: string,
  ): Promise<HLSpotClearinghouseState> {
    return this.infoPost<HLSpotClearinghouseState>({
      type: "spotClearinghouseState",
      user,
    });
  }

  /** Trade fills with time range filtering */
  async fetchUserFillsByTime(
    user: string,
    startTime: number,
    endTime: number,
  ): Promise<HLFill[]> {
    return this.infoPost<HLFill[]>({
      type: "userFillsByTime",
      user,
      startTime,
      endTime,
      aggregateByTime: true,
      reversed: true,
    });
  }

  /** Frontend-formatted open orders */
  async fetchFrontendOpenOrders(user: string): Promise<HLFrontendOrder[]> {
    return this.infoPost<HLFrontendOrder[]>({
      type: "frontendOpenOrders",
      user,
    });
  }

  // -- Exchange endpoints ---------------------------------------------------

  async placeOrder(
    action: HLOrderAction,
    nonce: number,
    signature: HLSignature,
    vaultAddress: string | null = null,
  ): Promise<HLExchangeResponse> {
    return this.exchangePost({
      action,
      nonce,
      signature,
      vaultAddress,
    });
  }

  async cancelOrder(
    action: HLCancelAction,
    nonce: number,
    signature: HLSignature,
    vaultAddress: string | null = null,
  ): Promise<HLExchangeResponse> {
    return this.exchangePost({
      action,
      nonce,
      signature,
      vaultAddress,
    });
  }

  /** Submit a user-signed action (withdraw, usdClassTransfer, etc.) */
  async submitUserSignedAction(
    action: Record<string, unknown>,
    nonce: number,
    signature: HLSignature,
  ): Promise<{ status: string; response?: unknown }> {
    return this.exchangePost({
      action,
      nonce,
      signature,
    });
  }

  // -- Internal -------------------------------------------------------------

  private async infoPost<T>(body: Record<string, unknown>): Promise<T> {
    try {
      return await this.doInfoPost<T>(body);
    } catch (err) {
      // Only retry on 5xx or network errors, not 4xx
      if (err instanceof HLApiError && err.status >= 400 && err.status < 500)
        throw err;
      this.log("warn", "Info request failed, retrying once", {
        type: body.type,
        error: err instanceof Error ? err.message : String(err),
      });
      await new Promise((r) => setTimeout(r, 1000));
      return this.doInfoPost<T>(body);
    }
  }

  private async doInfoPost<T>(body: Record<string, unknown>): Promise<T> {
    const res = await fetch(this.infoUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new HLApiError(
        res.status,
        `HL info API responded with ${res.status}: ${res.statusText}`,
      );
    }
    try {
      return (await res.json()) as T;
    } catch {
      throw new HLApiError(res.status, "Exchange returned non-JSON response");
    }
  }

  private async exchangePost<T>(body: Record<string, unknown>): Promise<T> {
    const res = await fetch(this.exchangeUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      throw new HLApiError(
        res.status,
        `HL exchange API responded with ${res.status}: ${res.statusText}`,
      );
    }
    try {
      return (await res.json()) as T;
    } catch {
      throw new HLApiError(res.status, "Exchange returned non-JSON response");
    }
  }
}
