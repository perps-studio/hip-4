// ---------------------------------------------------------------------------
// Unit tests for WebSocket reconnection state logic
// ---------------------------------------------------------------------------

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HIP4Client } from "../../src/adapter/hyperliquid/client";
import { HIP4MarketDataAdapter } from "../../src/adapter/hyperliquid/market-data";

// ---------------------------------------------------------------------------
// Mock WebSocket
// ---------------------------------------------------------------------------

type WsEventHandler = ((event: { data: string }) => void) | (() => void) | null;

const wsInstances: Array<{
  readyState: number;
  onmessage: WsEventHandler;
  onopen: WsEventHandler;
  onclose: WsEventHandler;
  onerror: WsEventHandler;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  simulateClose: () => void;
}> = [];

function resetWsInstances() {
  wsInstances.length = 0;
}

function createMockWebSocketClass() {
  // Use a named function so `new` works
  function MockWebSocket(this: any, _url: string) {
    this.readyState = 1; // OPEN
    this.onmessage = null;
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.send = vi.fn();
    this.close = vi.fn(() => {
      this.readyState = 3; // CLOSED
    });
    this.addEventListener = vi.fn((event: string, handler: () => void) => {
      if (event === "open" && this.readyState === 1) {
        // Fire immediately since our mock starts OPEN
        handler();
      }
    });
    this.removeEventListener = vi.fn();
    this.simulateClose = () => {
      if (this.onclose) {
        (this.onclose as () => void)();
      }
    };
    wsInstances.push(this);
  }
  MockWebSocket.CONNECTING = 0;
  MockWebSocket.OPEN = 1;
  MockWebSocket.CLOSING = 2;
  MockWebSocket.CLOSED = 3;
  MockWebSocket.prototype.CONNECTING = 0;
  MockWebSocket.prototype.OPEN = 1;
  MockWebSocket.prototype.CLOSING = 2;
  MockWebSocket.prototype.CLOSED = 3;

  return MockWebSocket;
}

// ---------------------------------------------------------------------------
// Mock HIP4Client
// ---------------------------------------------------------------------------

function createMockClient(): HIP4Client {
  return {
    testnet: true,
    infoUrl: "https://test",
    exchangeUrl: "https://test",
    wsUrl: "wss://test/ws",
    log: vi.fn(),
    fetchOutcomeMeta: vi.fn(),
    fetchAllMids: vi.fn(),
    fetchL2Book: vi.fn(),
    fetchRecentTrades: vi.fn(),
    fetchCandleSnapshot: vi.fn(),
    fetchClearinghouseState: vi.fn(),
    fetchUserFills: vi.fn(),
    fetchSpotClearinghouseState: vi.fn(),
    fetchUserFillsByTime: vi.fn(),
    fetchFrontendOpenOrders: vi.fn(),
    placeOrder: vi.fn(),
    cancelOrder: vi.fn(),
  } as unknown as HIP4Client;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WS reconnection state logic", () => {
  let originalWebSocket: typeof globalThis.WebSocket;

  beforeEach(() => {
    originalWebSocket = globalThis.WebSocket;
    resetWsInstances();
    vi.useFakeTimers();
  });

  afterEach(() => {
    globalThis.WebSocket = originalWebSocket;
    vi.useRealTimers();
  });

  it("increments reconnectAttempts after WS close", () => {
    vi.stubGlobal("WebSocket", createMockWebSocketClass());

    const client = createMockClient();
    const adapter = new HIP4MarketDataAdapter(client);

    // Subscribe to trigger WS creation
    const unsub = adapter.subscribeOrderBook("1758", vi.fn());

    expect(wsInstances).toHaveLength(1);

    // Simulate close - triggers reconnect timer
    wsInstances[0].simulateClose();

    // Advance past first reconnect delay (1000ms * 2^0 = 1000ms)
    vi.advanceTimersByTime(1000);

    // A new WS should have been created (reconnect attempt 1)
    expect(wsInstances).toHaveLength(2);

    // Close again
    wsInstances[1].simulateClose();

    // Advance past second reconnect delay (1000ms * 2^1 = 2000ms)
    vi.advanceTimersByTime(2000);

    // Third WS created (reconnect attempt 2)
    expect(wsInstances).toHaveLength(3);

    unsub();
    adapter.destroy();
  });

  it("stops reconnecting after MAX_RECONNECT_ATTEMPTS closes", () => {
    vi.stubGlobal("WebSocket", createMockWebSocketClass());

    const client = createMockClient();
    const adapter = new HIP4MarketDataAdapter(client);

    // Subscribe to trigger WS creation
    adapter.subscribeOrderBook("1758", vi.fn());
    expect(wsInstances).toHaveLength(1);

    // Simulate MAX_RECONNECT_ATTEMPTS (10) closes
    for (let i = 0; i < 10; i++) {
      const currentIdx = wsInstances.length - 1;
      wsInstances[currentIdx].simulateClose();

      // Advance past the reconnect delay (capped at 30s)
      const delay = Math.min(1000 * Math.pow(2, i), 30_000);
      vi.advanceTimersByTime(delay);
    }

    // After 10 reconnect attempts, we have 11 WS instances (1 original + 10 reconnects)
    const countAfterMax = wsInstances.length;

    // Now close the last one - should NOT create another WS
    wsInstances[wsInstances.length - 1].simulateClose();
    vi.advanceTimersByTime(60_000);

    expect(wsInstances).toHaveLength(countAfterMax);

    // Verify the error was logged
    expect(client.log).toHaveBeenCalledWith(
      "error",
      expect.stringContaining("max reconnect attempts"),
    );

    adapter.destroy();
  });

  it("destroy() during reconnect timer clears the timer", () => {
    vi.stubGlobal("WebSocket", createMockWebSocketClass());

    const client = createMockClient();
    const adapter = new HIP4MarketDataAdapter(client);

    adapter.subscribeOrderBook("1758", vi.fn());
    expect(wsInstances).toHaveLength(1);

    // Simulate close - reconnect timer starts
    wsInstances[0].simulateClose();

    // Before the timer fires, destroy the adapter
    adapter.destroy();

    // Advance past what would have been the reconnect delay
    vi.advanceTimersByTime(5000);

    // No new WS should have been created
    expect(wsInstances).toHaveLength(1);
  });

  it("destroyed flag prevents reconnection", () => {
    vi.stubGlobal("WebSocket", createMockWebSocketClass());

    const client = createMockClient();
    const adapter = new HIP4MarketDataAdapter(client);

    adapter.subscribeOrderBook("1758", vi.fn());
    expect(wsInstances).toHaveLength(1);

    // Destroy first, then simulate close
    adapter.destroy();
    wsInstances[0].simulateClose();

    vi.advanceTimersByTime(5000);

    // No reconnection should happen
    expect(wsInstances).toHaveLength(1);
  });
});
