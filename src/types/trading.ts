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
