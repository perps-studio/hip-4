// ---------------------------------------------------------------------------
// Hyperliquid HIP-4 Adapter - composes sub-adapters around a shared client
//
// HIP-4 prediction markets reuse the standard HL REST/WS API with:
//   @<outcomeId>              - outcome-level instrument (AMM-managed)
//   #<outcomeId><sideIndex>   - per-side probability market (0-1 range)
// ---------------------------------------------------------------------------

import type { CreateHIP4AdapterConfig } from "../factory";
import type { PredictionsAdapter } from "../types";
import { HIP4AccountAdapter } from "./account";
import { HIP4Auth } from "./auth";
import { HIP4Client } from "./client";
import { HIP4EventAdapter } from "./events";
import { HIP4MarketDataAdapter } from "./market-data";
import { HIP4TradingAdapter } from "./trading";

export class HyperliquidHip4Adapter implements PredictionsAdapter {
  readonly id = "hyperliquid";
  readonly name: string;
  readonly events: PredictionsAdapter["events"];
  readonly marketData: PredictionsAdapter["marketData"];
  readonly account: PredictionsAdapter["account"];
  readonly trading: PredictionsAdapter["trading"];
  readonly auth: PredictionsAdapter["auth"];

  private readonly client: HIP4Client;
  private readonly _marketData: HIP4MarketDataAdapter;

  constructor(config: CreateHIP4AdapterConfig = {}) {
    const testnet = config.testnet ?? true;
    this.name = testnet ? "Hyperliquid HIP-4 (Testnet)" : "Hyperliquid HIP-4";

    this.client = new HIP4Client({
      testnet,
      infoUrl: config.infoUrl,
      exchangeUrl: config.exchangeUrl,
      logger: config.logger,
    });

    const auth = new HIP4Auth();
    const eventAdapter = new HIP4EventAdapter(this.client);
    this.events = eventAdapter;
    this._marketData = new HIP4MarketDataAdapter(this.client);
    this.marketData = this._marketData;
    this.account = new HIP4AccountAdapter(this.client, eventAdapter);
    this.trading = new HIP4TradingAdapter(this.client, auth);
    this.auth = auth;
  }

  async initialize(): Promise<void> {
    await this.events.fetchCategories();
  }

  destroy(): void {
    this._marketData.destroy();
    this.auth.clearAuth();
  }
}
