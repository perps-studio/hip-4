export interface PredictionPosition {
  marketId: string;
  eventTitle: string;
  marketQuestion: string;
  outcome: string;
  shares: string;
  avgCost: string;
  currentPrice: string;
  unrealizedPnl: string;
  potentialPayout: string;
  eventStatus: "active" | "pending_resolution" | "resolved";
}

export interface PredictionActivity {
  id: string;
  type: "trade" | "redeem" | "deposit" | "withdrawal";
  marketId?: string;
  outcome?: string;
  side?: "buy" | "sell";
  price?: string;
  size?: string;
  amount?: string;
  timestamp: number;
}

export interface PredictionAuthState {
  status: "disconnected" | "pending_approval" | "ready";
  address?: string;
  apiKey?: string;
}
