// ---------------------------------------------------------------------------
// HIP-4 Market Data Adapter
//
// marketId = outcome ID as string (e.g. "10")
// Order book fetched for side 0 (first side / "Yes").
// Prices fetched for both sides via allMids.
// ---------------------------------------------------------------------------

import type { PredictionMarketDataAdapter, Unsubscribe } from "../types";
import type {
  PredictionOrderBook,
  PredictionPrice,
  PredictionTrade,
} from "../../types/market";
import type { HIP4Client } from "./client";
import { sideCoin } from "./client";
import type { SideNameResolver } from "./events";
import type { HLL2Book, HLTrade, HLWsL2BookData } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapBook(raw: HLL2Book, marketId: string): PredictionOrderBook {
  const [bids, asks] = raw.levels;
  return {
    marketId,
    bids: bids.map((l) => ({ price: l.px, size: l.sz })),
    asks: asks.map((l) => ({ price: l.px, size: l.sz })),
    timestamp: raw.time,
  };
}

function mapWsBook(raw: HLWsL2BookData, marketId: string): PredictionOrderBook {
  const [bids, asks] = raw.levels;
  return {
    marketId,
    bids: bids.map((l) => ({ price: l.px, size: l.sz })),
    asks: asks.map((l) => ({ price: l.px, size: l.sz })),
    timestamp: raw.time,
  };
}

function mapTrade(raw: HLTrade, marketId: string): PredictionTrade {
  return {
    id: String(raw.tid),
    marketId,
    outcome: raw.coin,
    side: raw.side === "B" ? "buy" : "sell",
    price: raw.px,
    size: raw.sz,
    timestamp: raw.time,
  };
}

// ---------------------------------------------------------------------------
// WebSocket pool entry
// ---------------------------------------------------------------------------

interface WsPoolEntry {
  ws: WebSocket;
  subscriptions: Map<string, Set<(msg: unknown) => void>>;
  refCount: number;
}

// ---------------------------------------------------------------------------
// HIP4MarketDataAdapter
// ---------------------------------------------------------------------------

export class HIP4MarketDataAdapter implements PredictionMarketDataAdapter {
  private wsPool: WsPoolEntry | null = null;
  private midsCache: { data: Record<string, string>; time: number } | null =
    null;
  private static readonly MIDS_CACHE_TTL = 5_000;
  private static readonly MAX_RECONNECT_ATTEMPTS = 10;
  private static readonly MAX_RECONNECT_DELAY = 30_000;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  private readonly resolveSideNames: SideNameResolver;
  private readonly ensureSideNames?: () => Promise<void>;

  constructor(
    private readonly client: HIP4Client,
    resolveSideNames?: SideNameResolver,
    ensureSideNames?: () => Promise<void>,
  ) {
    this.resolveSideNames = resolveSideNames ?? (() => null);
    this.ensureSideNames = ensureSideNames;
  }

  async fetchOrderBook(marketId: string, sideIndex: number = 0): Promise<PredictionOrderBook> {
    const outcomeId = parseInt(marketId, 10);
    const coin = sideCoin(outcomeId, sideIndex);
    const raw = await this.client.fetchL2Book(coin);
    return mapBook(raw, marketId);
  }

  private sideNamesFor(marketId: string): [string, string] {
    const outcomeId = parseInt(marketId, 10);
    return this.resolveSideNames(outcomeId) ?? ["Side 0", "Side 1"];
  }

  async fetchPrice(marketId: string): Promise<PredictionPrice> {
    await this.ensureSideNames?.();
    const outcomeId = parseInt(marketId, 10);
    const mids = await this.getMids();
    const [name0, name1] = this.sideNamesFor(marketId);

    const side0Coin = sideCoin(outcomeId, 0);
    const side1Coin = sideCoin(outcomeId, 1);

    const side0Mid = mids[side0Coin] ?? "0";
    const side1Mid = mids[side1Coin] ?? "0";

    return {
      marketId,
      outcomes: [
        { name: name0, price: side0Mid, midpoint: side0Mid },
        { name: name1, price: side1Mid, midpoint: side1Mid },
      ],
      timestamp: Date.now(),
    };
  }

  async fetchTrades(
    marketId: string,
    limit = 50,
    sideIndex: number = 0,
  ): Promise<PredictionTrade[]> {
    const outcomeId = parseInt(marketId, 10);
    const coin = sideCoin(outcomeId, sideIndex);
    const raw = await this.client.fetchRecentTrades(coin);
    return raw.slice(0, limit).map((t) => mapTrade(t, marketId));
  }

  async fetchCandles(
    marketId: string,
    interval = "1h",
    startTime?: number,
    endTime?: number,
  ): Promise<Array<{ time: number; open: number; high: number; low: number; close: number; volume: number }>> {
    const outcomeId = parseInt(marketId, 10);
    const coin = sideCoin(outcomeId, 0);
    const now = Date.now();
    const start = startTime ?? now - 14 * 24 * 60 * 60 * 1000;
    const end = endTime ?? now;
    const raw = await this.client.fetchCandleSnapshot(coin, interval, start, end);
    return raw.map((c) => ({
      time: c.t / 1000,
      open: parseFloat(c.o),
      high: parseFloat(c.h),
      low: parseFloat(c.l),
      close: parseFloat(c.c),
      volume: parseFloat(c.v),
    }));
  }

  // -- WebSocket subscriptions --------------------------------------------

  subscribeOrderBook(
    marketId: string,
    onData: (book: PredictionOrderBook) => void,
  ): Unsubscribe {
    const outcomeId = parseInt(marketId, 10);
    const coin = sideCoin(outcomeId, 0);
    return this.subscribeWs("l2Book", coin, (data) => {
      if (isL2BookData(data)) {
        onData(mapWsBook(data, marketId));
      }
    });
  }

  subscribePrice(
    marketId: string,
    onData: (price: PredictionPrice) => void,
  ): Unsubscribe {
    const outcomeId = parseInt(marketId, 10);
    const coin0 = sideCoin(outcomeId, 0);
    const coin1 = sideCoin(outcomeId, 1);

    return this.subscribeWs("allMids", "*", (data) => {
      if (!isAllMidsData(data)) return;
      const mids = data.mids as Record<string, string>;
      const side0Mid = mids[coin0];
      const side1Mid = mids[coin1];
      if (side0Mid === undefined && side1Mid === undefined) return;

      // Resolve names on each callback so we pick up sideSpec names
      // once they're loaded (may be "Side 0"/"Side 1" on first tick)
      const [n0, n1] = this.sideNamesFor(marketId);

      onData({
        marketId,
        outcomes: [
          {
            name: n0,
            price: side0Mid ?? "0",
            midpoint: side0Mid ?? "0",
          },
          {
            name: n1,
            price: side1Mid ?? "0",
            midpoint: side1Mid ?? "0",
          },
        ],
        timestamp: Date.now(),
      });
    });
  }

  subscribeTrades(
    marketId: string,
    onData: (trade: PredictionTrade) => void,
  ): Unsubscribe {
    const outcomeId = parseInt(marketId, 10);
    const coin = sideCoin(outcomeId, 0);
    return this.subscribeWs("trades", coin, (data) => {
      if (!isTradesData(data)) return;
      for (const t of data) {
        onData(mapTrade(t as HLTrade, marketId));
      }
    });
  }

  /** Close the WebSocket and stop any pending reconnection */
  destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.wsPool) {
      this.wsPool.ws.close();
      this.wsPool = null;
    }
  }

  // -- Internal helpers ---------------------------------------------------

  private async getMids(): Promise<Record<string, string>> {
    const now = Date.now();
    if (
      this.midsCache &&
      now - this.midsCache.time < HIP4MarketDataAdapter.MIDS_CACHE_TTL
    ) {
      return this.midsCache.data;
    }
    const data = await this.client.fetchAllMids();
    this.midsCache = { data, time: now };
    return data;
  }

  private ensureWs(): WsPoolEntry {
    if (this.wsPool) return this.wsPool;

    const ws = new WebSocket(this.client.wsUrl);
    const entry: WsPoolEntry = {
      ws,
      subscriptions: new Map(),
      refCount: 0,
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(String(event.data)) as {
          channel?: string;
          data?: unknown;
        };
        if (!msg.channel || msg.data === undefined) return;

        // Per-coin subscriptions are stored as "channel:coin" (e.g. "l2Book:#100").
        // HL sends channel without coin — the coin is inside data.
        // For l2Book: data is { coin, ... }. For trades: data is [{ coin, ... }, ...].
        const raw = msg.data;
        const dataCoin = Array.isArray(raw)
          ? (raw[0] as Record<string, unknown>)?.coin as string | undefined
          : (raw as Record<string, unknown>)?.coin as string | undefined;
        if (dataCoin) {
          const coinSubs = entry.subscriptions.get(`${msg.channel}:${dataCoin}`);
          if (coinSubs) {
            for (const cb of coinSubs) cb(msg.data);
          }
        }

        // Channel-only subscriptions (e.g. "allMids" without a coin)
        const channelSubs = entry.subscriptions.get(msg.channel);
        if (channelSubs) {
          for (const cb of channelSubs) cb(msg.data);
        }
      } catch {
        // Ignore unparseable frames
      }
    };

    ws.onopen = () => {
      // Reset reconnect counter on successful connection
      this.reconnectAttempts = 0;
    };

    ws.onclose = () => {
      const savedSubscriptions = new Map(entry.subscriptions);
      const savedRefCount = entry.refCount;
      this.wsPool = null;

      if (this.destroyed) return;
      if (savedSubscriptions.size === 0) return;
      if (this.reconnectAttempts >= HIP4MarketDataAdapter.MAX_RECONNECT_ATTEMPTS) {
        this.client.log("error", `WS max reconnect attempts (${HIP4MarketDataAdapter.MAX_RECONNECT_ATTEMPTS}) reached, giving up`);
        return;
      }

      const delay = Math.min(
        1000 * Math.pow(2, this.reconnectAttempts),
        HIP4MarketDataAdapter.MAX_RECONNECT_DELAY,
      );
      this.reconnectAttempts++;
      this.client.log("warn", `WS connection closed, reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${HIP4MarketDataAdapter.MAX_RECONNECT_ATTEMPTS})`);

      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        if (this.destroyed) return;

        // Create a new WS and restore subscriptions
        const newEntry = this.ensureWs();
        newEntry.refCount = savedRefCount;

        for (const [subKey, callbacks] of savedSubscriptions) {
          newEntry.subscriptions.set(subKey, new Set(callbacks));

          // Re-send subscription messages once connected
          const colonIdx = subKey.indexOf(":");
          const channel = colonIdx >= 0 ? subKey.slice(0, colonIdx) : subKey;
          const coin = colonIdx >= 0 ? subKey.slice(colonIdx + 1) : "*";

          const sendResub = () => {
            if (coin === "*") {
              newEntry.ws.send(
                JSON.stringify({
                  method: "subscribe",
                  subscription: { type: channel },
                }),
              );
            } else {
              newEntry.ws.send(
                JSON.stringify({
                  method: "subscribe",
                  subscription: { type: channel, coin },
                }),
              );
            }
          };

          if (newEntry.ws.readyState === WebSocket.OPEN) {
            sendResub();
          } else {
            newEntry.ws.addEventListener("open", sendResub, { once: true });
          }
        }
      }, delay);
    };

    this.wsPool = entry;
    return entry;
  }

  private subscribeWs(
    channel: string,
    coin: string,
    onData: (data: unknown) => void,
  ): Unsubscribe {
    const entry = this.ensureWs();
    entry.refCount++;

    const subKey = coin === "*" ? channel : `${channel}:${coin}`;

    if (!entry.subscriptions.has(subKey)) {
      entry.subscriptions.set(subKey, new Set());
    }
    entry.subscriptions.get(subKey)!.add(onData);

    const sendSub = () => {
      if (coin === "*") {
        entry.ws.send(
          JSON.stringify({
            method: "subscribe",
            subscription: { type: channel },
          }),
        );
      } else {
        entry.ws.send(
          JSON.stringify({
            method: "subscribe",
            subscription: { type: channel, coin },
          }),
        );
      }
    };

    if (entry.ws.readyState === WebSocket.OPEN) {
      sendSub();
    } else {
      entry.ws.addEventListener("open", sendSub, { once: true });
    }

    return () => {
      // Use current wsPool (may differ from captured entry after reconnect)
      const current = this.wsPool;
      if (!current) return;
      const subs = current.subscriptions.get(subKey);
      if (subs) {
        subs.delete(onData);
        if (subs.size === 0) {
          current.subscriptions.delete(subKey);
        }
      }
      current.refCount--;
      if (current.refCount <= 0 && current.ws.readyState === WebSocket.OPEN) {
        current.ws.close();
        this.wsPool = null;
      }
    };
  }
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isL2BookData(data: unknown): data is HLWsL2BookData {
  return (
    typeof data === "object" &&
    data !== null &&
    "coin" in data &&
    "levels" in data
  );
}

function isAllMidsData(
  data: unknown,
): data is { mids: Record<string, string> } {
  return typeof data === "object" && data !== null && "mids" in data;
}

function isTradesData(data: unknown): data is HLTrade[] {
  return Array.isArray(data);
}
