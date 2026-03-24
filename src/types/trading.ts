export interface PredictionOrderParams {
  marketId: string;
  outcome: string;
  side: "buy" | "sell";
  type: "market" | "limit";
  price?: string;
  amount: string;
  timeInForce?: "GTC" | "GTD" | "FOK" | "FAK";
  expiration?: string;
}

export interface PredictionOrderResult {
  success: boolean;
  orderId?: string;
  status?: string;
  shares?: string;
  error?: string;
}

export interface PredictionCancelParams {
  marketId: string;
  orderId: string;
  /** Optional outcome identifier (e.g. "#5160") to resolve the correct side asset ID */
  outcome?: string;
}
