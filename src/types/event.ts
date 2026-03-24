export interface PredictionEvent {
  id: string;
  title: string;
  description: string;
  category: string;
  markets: PredictionMarket[];
  totalVolume: string;
  endDate: string;
  status: PredictionEventStatus;
  imageUrl?: string;
  resolutionSource?: string;
}

export type PredictionEventStatus =
  | "active"
  | "pending_resolution"
  | "resolved"
  | "cancelled";

export interface PredictionMarket {
  id: string;
  eventId: string;
  question: string;
  outcomes: PredictionOutcome[];
  volume: string;
  liquidity: string;
  isNegRisk?: boolean;
}

export interface PredictionOutcome {
  name: string;
  tokenId: string;
  price: string;
}

export interface PredictionCategory {
  id: string;
  name: string;
  slug: string;
}
