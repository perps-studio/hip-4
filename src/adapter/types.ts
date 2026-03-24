import type {
  PredictionEvent,
  PredictionCategory,
} from "../types/event";
import type {
  PredictionOrderBook,
  PredictionTrade,
  PredictionPrice,
} from "../types/market";
import type {
  PredictionPosition,
  PredictionActivity,
  PredictionAuthState,
} from "../types/account";
import type {
  PredictionOrderParams,
  PredictionOrderResult,
  PredictionCancelParams,
} from "../types/trading";

export type Unsubscribe = () => void;

export interface PredictionsAdapter {
  readonly id: string;
  readonly name: string;

  readonly events: PredictionEventAdapter;
  readonly marketData: PredictionMarketDataAdapter;
  readonly account: PredictionAccountAdapter;
  readonly trading: PredictionTradingAdapter;
  readonly auth: PredictionAuthAdapter;

  initialize(): Promise<void>;
  destroy(): void;
}

export interface PredictionEventAdapter {
  fetchEvents(params?: {
    category?: string;
    active?: boolean;
    limit?: number;
    offset?: number;
    query?: string;
  }): Promise<PredictionEvent[]>;
  fetchEvent(eventId: string): Promise<PredictionEvent>;
  fetchCategories(): Promise<PredictionCategory[]>;
}

export interface PredictionMarketDataAdapter {
  fetchOrderBook(marketId: string, sideIndex?: number): Promise<PredictionOrderBook>;
  fetchPrice(marketId: string): Promise<PredictionPrice>;
  fetchTrades(marketId: string, limit?: number): Promise<PredictionTrade[]>;
  fetchCandles(
    marketId: string,
    interval?: string,
    startTime?: number,
    endTime?: number,
  ): Promise<Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>>;

  subscribeOrderBook(
    marketId: string,
    onData: (book: PredictionOrderBook) => void,
  ): Unsubscribe;
  subscribePrice(
    marketId: string,
    onData: (price: PredictionPrice) => void,
  ): Unsubscribe;
  subscribeTrades(
    marketId: string,
    onData: (trade: PredictionTrade) => void,
  ): Unsubscribe;
}

export interface PredictionAccountAdapter {
  fetchPositions(address: string): Promise<PredictionPosition[]>;
  fetchActivity(address: string): Promise<PredictionActivity[]>;
  fetchBalance(address: string): Promise<Array<{ coin: string; total: string; hold: string }>>;
  fetchOpenOrders(address: string): Promise<Array<{
    coin: string;
    side: "B" | "A";
    limitPx: string;
    sz: string;
    oid: number;
    timestamp: number;
  }>>;
  subscribePositions(
    address: string,
    onData: (positions: PredictionPosition[]) => void,
  ): Unsubscribe;
}

export interface PredictionTradingAdapter {
  placeOrder(params: PredictionOrderParams): Promise<PredictionOrderResult>;
  cancelOrder(params: PredictionCancelParams): Promise<void>;
}

export interface PredictionAuthAdapter {
  initAuth(
    walletAddress: string,
    signer: unknown,
  ): Promise<PredictionAuthState>;
  getAuthStatus(): PredictionAuthState;
  clearAuth(): void;
}
