// ---------------------------------------------------------------------------
// HIP-4 Account Adapter
//
// Positions: from spotClearinghouseState, filtered to outcome coins (@ / #)
// Activity: from userFillsByTime (30-day range), filtered to outcome coins
// ---------------------------------------------------------------------------

import type {
  PredictionActivity,
  PredictionPosition,
} from "../../types/account";
import type { PredictionEvent } from "../../types/event";
import type { PredictionAccountAdapter, Unsubscribe } from "../types";
import type { HIP4Client } from "./client";
import { coinOutcomeId, isOutcomeCoin, parseSideCoin } from "./client";
import type { HLFill } from "./types";

/** Minimal interface for fetching event data (avoids importing the full event adapter class). */
interface EventDataSource {
  fetchEvents(params?: { limit?: number }): Promise<PredictionEvent[]>;
}

const POLL_INTERVAL_MS = 10_000;

interface SpotBalance {
  coin: string;
  total: string;
  entryNtl: string;
}

function mapSpotBalance(
  bal: SpotBalance,
  allMids: Record<string, string>,
  nameMap: Map<string, { eventTitle: string; marketQuestion: string }>,
): PredictionPosition | null {
  const coin = bal.coin;
  if (!isOutcomeCoin(coin)) return null;

  const total = parseFloat(bal.total);
  if (total === 0) return null;

  const outcomeId = coinOutcomeId(coin);
  const marketId = outcomeId !== null ? String(outcomeId) : coin;

  const parsed = parseSideCoin(coin);
  const outcome = parsed ? `Side ${parsed.sideIndex}` : coin;

  const entryNtl = parseFloat(bal.entryNtl);
  const avgCost = total !== 0 ? entryNtl / total : 0;

  const mid = allMids[coin];
  const currentPrice = mid ? parseFloat(mid) : 0;
  const unrealizedPnl = (currentPrice - avgCost) * total;
  const potentialPayout = total;

  const names = nameMap.get(marketId);
  return {
    marketId,
    eventTitle: names?.eventTitle ?? "",
    marketQuestion: names?.marketQuestion ?? "",
    outcome,
    shares: total.toFixed(6),
    avgCost: avgCost.toFixed(6),
    currentPrice: mid ?? "0",
    unrealizedPnl: unrealizedPnl.toFixed(6),
    potentialPayout: potentialPayout.toFixed(6),
    eventStatus: "active",
  };
}

function mapFill(raw: HLFill): PredictionActivity | null {
  if (!isOutcomeCoin(raw.coin)) return null;

  const outcomeId = coinOutcomeId(raw.coin);
  const marketId = outcomeId !== null ? String(outcomeId) : raw.coin;

  return {
    id: String(raw.tid),
    type: "trade",
    marketId,
    outcome: raw.coin,
    side: raw.side === "B" ? "buy" : "sell",
    price: raw.px,
    size: raw.sz,
    timestamp: raw.time,
  };
}

export class HIP4AccountAdapter implements PredictionAccountAdapter {
  constructor(
    private readonly client: HIP4Client,
    private readonly events?: EventDataSource,
  ) {}

  async fetchPositions(address: string): Promise<PredictionPosition[]> {
    const [state, allMids, eventList] = await Promise.all([
      this.client.fetchSpotClearinghouseState(address),
      this.client.fetchAllMids(),
      this.events?.fetchEvents({ limit: 200 }).catch(() => [] as PredictionEvent[]) ??
        Promise.resolve([] as PredictionEvent[]),
    ]);

    // Build name lookup: marketId (outcome ID string) → { eventTitle, marketQuestion }
    const nameMap = new Map<string, { eventTitle: string; marketQuestion: string }>();
    for (const event of eventList) {
      for (const market of event.markets) {
        nameMap.set(market.id, { eventTitle: event.title, marketQuestion: market.question });
      }
    }

    const positions: PredictionPosition[] = [];
    for (const bal of state.balances) {
      if (!isOutcomeCoin(bal.coin)) continue;
      if (parseFloat(bal.total) === 0) continue;

      const mapped = mapSpotBalance(bal, allMids, nameMap);
      if (mapped) positions.push(mapped);
    }

    return positions;
  }

  async fetchActivity(address: string): Promise<PredictionActivity[]> {
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    const startTime = now - thirtyDaysMs;

    const fills = await this.client.fetchUserFillsByTime(
      address,
      startTime,
      now,
    );
    const activities: PredictionActivity[] = [];
    for (const fill of fills) {
      const mapped = mapFill(fill);
      if (mapped) activities.push(mapped);
    }
    return activities;
  }

  async fetchBalance(
    address: string,
  ): Promise<Array<{ coin: string; total: string; hold: string }>> {
    const state = await this.client.fetchSpotClearinghouseState(address);
    return state.balances.map((b) => ({
      coin: b.coin,
      total: b.total,
      hold: b.hold,
    }));
  }

  async fetchOpenOrders(address: string): Promise<
    Array<{
      coin: string;
      side: "B" | "A";
      limitPx: string;
      sz: string;
      oid: number;
      timestamp: number;
    }>
  > {
    const orders = await this.client.fetchFrontendOpenOrders(address);
    return orders.map((o) => ({
      coin: o.coin,
      side: o.side,
      limitPx: o.limitPx,
      sz: o.sz,
      oid: o.oid,
      timestamp: o.timestamp,
    }));
  }

  subscribePositions(
    address: string,
    onData: (positions: PredictionPosition[]) => void,
  ): Unsubscribe {
    let active = true;

    // Note: effective interval is POLL_INTERVAL_MS + fetch duration. This is
    // intentional - prevents overlapping requests on slow networks.
    const poll = async () => {
      while (active) {
        try {
          const positions = await this.fetchPositions(address);
          if (active) onData(positions);
        } catch {
          // Silently continue polling
        }
        if (active) {
          await sleep(POLL_INTERVAL_MS);
        }
      }
    };

    void poll();

    return () => {
      active = false;
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
