// ---------------------------------------------------------------------------
// Raw Hyperliquid HIP-4 API response types - reverse-engineered from testnet
// ---------------------------------------------------------------------------

// -- outcomeMeta --------------------------------------------------------------

export interface HLOutcomeMeta {
  outcomes: HLOutcome[];
  questions: HLQuestion[];
}

export interface HLOutcome {
  outcome: number;
  name: string;
  description: string;
  sideSpecs: HLSideSpec[];
}

export interface HLSideSpec {
  name: string;
}

export interface HLQuestion {
  question: number;
  name: string;
  description: string;
  fallbackOutcome: number;
  namedOutcomes: number[];
  settledNamedOutcomes: number[];
}

// -- L2 book (standard HL format) -------------------------------------------

export interface HLL2Book {
  coin: string;
  time: number;
  levels: [HLL2Level[], HLL2Level[]]; // [bids, asks]
}

export interface HLL2Level {
  px: string;
  sz: string;
  n: number;
}

// -- Recent trades (standard HL format) -------------------------------------

export interface HLTrade {
  coin: string;
  side: "B" | "A"; // B = buy, A = sell (ask)
  px: string;
  sz: string;
  time: number;
  hash: string;
  tid: number;
  users: [string, string];
}

// -- Candle snapshot (standard HL format) -----------------------------------

export interface HLCandle {
  t: number; // open time
  T: number; // close time
  s: string; // symbol
  i: string; // interval
  o: string; // open
  c: string; // close
  h: string; // high
  l: string; // low
  v: string; // volume
  n: number; // trade count
}

// -- allMids ----------------------------------------------------------------

export type HLAllMids = Record<string, string>;

// -- clearinghouseState (positions) -----------------------------------------

export interface HLClearinghouseState {
  marginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  crossMarginSummary: {
    accountValue: string;
    totalNtlPos: string;
    totalRawUsd: string;
    totalMarginUsed: string;
  };
  crossMaintenanceMarginUsed: string;
  withdrawable: string;
  assetPositions: HLAssetPosition[];
  time: number;
}

export interface HLAssetPosition {
  type: string;
  position: {
    coin: string;
    szi: string;
    entryPx: string;
    positionValue: string;
    unrealizedPnl: string;
    returnOnEquity: string;
    liquidationPx: string | null;
    marginUsed: string;
    maxLeverage: number;
    leverage: {
      type: string;
      value: number;
      rawUsd?: string;
    };
    cumFunding: {
      allTime: string;
      sinceOpen: string;
      sinceChange: string;
    };
  };
}

// -- spotClearinghouseState -------------------------------------------------

/** Spot clearinghouse state - HIP-4 prediction balances live here */
export interface HLSpotClearinghouseState {
  balances: Array<{
    coin: string;
    token: number;
    hold: string;
    total: string;
    entryNtl: string;
  }>;
}

// -- frontendOpenOrders ----------------------------------------------------

/** Frontend-formatted open order */
export interface HLFrontendOrder {
  coin: string;
  side: "B" | "A";
  limitPx: string;
  sz: string;
  oid: number;
  timestamp: number;
  origSz: string;
  reduceOnly: boolean;
  orderType: string;
  tif: string | null;
  cloid: string | null;
}

// -- userFills --------------------------------------------------------------

export interface HLFill {
  coin: string;
  px: string;
  sz: string;
  side: "B" | "A";
  time: number;
  startPosition: string;
  dir: string;
  closedPnl: string;
  hash: string;
  oid: number;
  crossed: boolean;
  fee: string;
  tid: number;
  feeToken: string;
}

// -- Exchange API (order placement) -----------------------------------------

export interface HLOrderAction {
  type: "order";
  orders: HLOrderWire[];
  grouping: "na";
}

export interface HLOrderWire {
  a: number; // asset index
  b: boolean; // true = buy
  p: string; // price
  s: string; // size
  r: boolean; // reduce only
  t: HLOrderType;
  /** Client order ID (hex string). Optional. */
  c?: string;
}

export type HLOrderType =
  | { limit: { tif: "Gtc" | "Ioc" | "Alo" | "FrontendMarket" } }
  | { trigger: { triggerPx: string; isMarket: boolean; tpsl: "tp" | "sl" } };

export interface HLExchangeRequest {
  action: HLOrderAction;
  nonce: number;
  signature: HLSignature;
  vaultAddress: string | null;
}

export interface HLSignature {
  r: string;
  s: string;
  v: number;
}

export interface HLExchangeResponse {
  status: "ok" | "err";
  response?: {
    type: "order";
    data: {
      statuses: HLOrderStatus[];
    };
  };
}

export type HLOrderStatus =
  | {
      filled: {
        totalSz: string;
        avgPx: string;
        oid: number;
      };
    }
  | {
      resting: {
        oid: number;
      };
    }
  | {
      error: string;
    };

// -- Cancel action ----------------------------------------------------------

export interface HLCancelAction {
  type: "cancel";
  cancels: Array<{ a: number; o: number }>;
}

export interface HLCancelRequest {
  action: HLCancelAction;
  nonce: number;
  signature: HLSignature;
  vaultAddress: string | null;
}

// -- WebSocket messages -----------------------------------------------------

export interface HLWsMessage {
  channel: string;
  data: unknown;
}

export interface HLWsL2BookData {
  coin: string;
  time: number;
  levels: [
    Array<{ px: string; sz: string; n: number }>,
    Array<{ px: string; sz: string; n: number }>,
  ];
}

export interface HLWsTradeData {
  coin: string;
  side: "B" | "A";
  px: string;
  sz: string;
  time: number;
  hash: string;
  tid: number;
}

// -- Signer interface -------------------------------------------------------
// Consumers provide a signer that can produce EIP-712 signatures for HL actions.
// Supports both native HLSignature ({r, s, v}) and hex strings (viem output).

export interface HIP4Signer {
  getAddress(): string | Promise<string>;

  /**
   * Sign a typed-data payload (EIP-712).
   * Can return either:
   *   - HLSignature ({r, s, v}) directly
   *   - A hex string "0x..." which will be split into {r, s, v}
   */
  signTypedData(
    domain: Record<string, unknown>,
    types: Record<string, Array<{ name: string; type: string }>>,
    value: Record<string, unknown>,
  ): Promise<HLSignature | string>;
}

/**
 * Convert a viem hex signature (0x + 32 bytes r + 32 bytes s + 1 byte v)
 * into the {r, s, v} format HL expects.
 */
export function splitHexSignature(hex: string): HLSignature {
  const raw = hex.startsWith("0x") ? hex.slice(2) : hex;
  return {
    r: "0x" + raw.slice(0, 64),
    s: "0x" + raw.slice(64, 128),
    v: parseInt(raw.slice(128, 130), 16),
  };
}

/**
 * Normalize a signature that may be hex or already split.
 */
export function normalizeSignature(sig: HLSignature | string): HLSignature {
  if (typeof sig === "string") {
    return splitHexSignature(sig);
  }
  return sig;
}
