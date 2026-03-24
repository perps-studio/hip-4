export interface PredictionOrderBook {
  marketId: string;
  bids: PredictionOrderBookLevel[];
  asks: PredictionOrderBookLevel[];
  timestamp: number;
}

export interface PredictionOrderBookLevel {
  price: string;
  size: string;
}

export interface PredictionTrade {
  id: string;
  marketId: string;
  outcome: string;
  side: "buy" | "sell";
  price: string;
  size: string;
  timestamp: number;
}

export interface PredictionPrice {
  marketId: string;
  outcomes: Array<{
    name: string;
    price: string;
    midpoint: string;
  }>;
  timestamp: number;
}
