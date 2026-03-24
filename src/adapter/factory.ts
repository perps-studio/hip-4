import type { PredictionsAdapter } from "./types";
import { HyperliquidHip4Adapter } from "./hyperliquid";

export interface CreateHIP4AdapterConfig {
  testnet?: boolean;
  infoUrl?: string;
  exchangeUrl?: string;
  /** Optional logger. Default: no-op. */
  logger?: (level: "debug" | "info" | "warn" | "error", msg: string, data?: unknown) => void;
}

export function createHIP4Adapter(
  config: CreateHIP4AdapterConfig = {},
): PredictionsAdapter {
  return new HyperliquidHip4Adapter(config);
}
