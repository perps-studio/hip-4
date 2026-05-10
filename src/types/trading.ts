/** Parameters for placing a prediction market order. */
export interface PredictionOrderParams {
  marketId: string;
  outcome: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  /** Required for limit orders. */
  price?: string;
  amount: string;
  timeInForce?: "GTC" | "GTD" | "FOK" | "FAK";
  expiration?: string;
  /**
   * Mark price of the coin (0-1), used for minimum notional validation.
   * When provided, getMinShares(markPx) is enforced before submission.
   */
  markPx?: number;
  /**
   * Builder address for referral fees.
   * Will be lowercased  - checksummed addresses are accepted.
   */
  builderAddress?: string;
  /**
   * Builder fee in tenths of a basis point.
   * 0 = no fee. 100 = 0.1%. 1000 = 1.0% (maximum).
   */
  builderFee?: number;
}

/** Result returned by placeOrder. Never throws. Check success/error fields. */
export interface PredictionOrderResult {
  success: boolean;
  orderId?: string;
  status?: string;
  shares?: string;
  error?: string;
}

/** Parameters for cancelling a resting order. */
export interface PredictionCancelParams {
  marketId: string;
  orderId: string;
  /** Optional outcome identifier (e.g. "#5160") to resolve the correct side asset ID. */
  outcome?: string;
}
