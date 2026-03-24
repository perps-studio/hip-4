# HIP-4 Prediction Markets SDK - Comprehensive Test Plan

> **Package**: `@perps/hip4`
> **Last updated**: 2026-03-22
> **Source**: `src/adapter/hyperliquid/` (client, events, account, trading, auth, market-data, types)
> **Hooks**: `src/hooks/` (useEvents, useEventDetail, usePredictionBook, usePredictionPrice, usePredictionPositions)

---

## Table of Contents

1. [Test Infrastructure](#1-test-infrastructure)
2. [Unit Tests (Vitest)](#2-unit-tests-vitest)
   - 2.1 [Coin Helper Tests](#21-coin-helper-tests)
   - 2.2 [Signature Utility Tests](#22-signature-utility-tests)
   - 2.3 [Event Mapping Tests](#23-event-mapping-tests)
   - 2.4 [Account Mapping Tests](#24-account-mapping-tests)
   - 2.5 [Trading Helper Tests](#25-trading-helper-tests)
   - 2.6 [Auth Tests](#26-auth-tests)
   - 2.7 [Market Data Tests](#27-market-data-tests)
   - 2.8 [Client Tests](#28-client-tests)
   - 2.9 [Factory & Adapter Composition Tests](#29-factory--adapter-composition-tests)
3. [Integration Tests (Live Testnet)](#3-integration-tests-live-testnet)
4. [E2E Tests (Playwright)](#4-e2e-tests-playwright)
5. [Fixtures & Helpers](#5-fixtures--helpers)
6. [CI/CD](#6-cicd)
7. [Coverage](#7-coverage)

---

## 1. Test Infrastructure

### Framework

- **Unit tests**: Vitest (add `vitest` to devDependencies)
- **E2E tests**: Playwright (separate `@playwright/test` devDependency)
- **Test wallet**: `viem` `privateKeyToAccount` for EIP-712 signing in integration tests
- **Environment**: Hyperliquid testnet (`https://api-ui.hyperliquid-testnet.xyz`)

### Directory Structure

```
tests/
├── unit/
│   ├── coin-helpers.test.ts
│   ├── signature-utils.test.ts
│   ├── event-mapping.test.ts
│   ├── account-mapping.test.ts
│   ├── trading-helpers.test.ts
│   ├── auth.test.ts
│   ├── market-data.test.ts
│   ├── client.test.ts
│   └── factory.test.ts
├── integration/
│   ├── rest-endpoints.test.ts
│   ├── order-lifecycle.test.ts
│   └── websocket.test.ts
├── e2e/
│   ├── event-browsing.spec.ts
│   ├── trading-flow.spec.ts
│   └── realtime-data.spec.ts
├── fixtures/
│   ├── outcome-meta.ts
│   ├── l2-book.ts
│   ├── trades.ts
│   ├── all-mids.ts
│   ├── spot-clearinghouse.ts
│   ├── fills.ts
│   ├── exchange-responses.ts
│   └── frontend-orders.ts
└── helpers/
    ├── mock-client.ts
    ├── mock-signer.ts
    └── test-wallet.ts
```

### Vitest Config

```ts
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    globals: true,
    testTimeout: 30_000, // integration tests need network time
    coverage: {
      provider: "v8",
      include: ["src/adapter/**/*.ts"],
      exclude: ["src/adapter/hyperliquid/types.ts", "src/hooks/**"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
```

---

## 2. Unit Tests (Vitest)

### 2.1 Coin Helper Tests

**File**: `tests/unit/coin-helpers.test.ts`

Tests the six coin-naming helper functions exported from `src/adapter/hyperliquid/client.ts`: `outcomeCoin`, `sideCoin`, `sideAssetId`, `parseSideCoin`, `parseOutcomeCoin`, `coinOutcomeId`, `isOutcomeCoin`.

```ts
describe("outcomeCoin", () => {
  it("returns @-prefixed string for outcome ID 1338", () => {
    // Setup: none
    // Assert: outcomeCoin(1338) === "@1338"
  });

  it("returns @0 for outcome ID 0", () => {
    // Assert: outcomeCoin(0) === "@0"
  });

  it("returns @999999 for large outcome ID", () => {
    // Assert: outcomeCoin(999999) === "@999999"
  });
});

describe("sideCoin", () => {
  it("returns #5160 for outcomeId=516, sideIndex=0", () => {
    // Assert: sideCoin(516, 0) === "#5160"
  });

  it("returns #5161 for outcomeId=516, sideIndex=1", () => {
    // Assert: sideCoin(516, 1) === "#5161"
  });

  it("returns #00 for outcomeId=0, sideIndex=0", () => {
    // Assert: sideCoin(0, 0) === "#00"
  });

  it("returns #13380 for outcomeId=1338, sideIndex=0", () => {
    // Assert: sideCoin(1338, 0) === "#13380"
  });

  it("returns #13381 for outcomeId=1338, sideIndex=1", () => {
    // Assert: sideCoin(1338, 1) === "#13381"
  });
});

describe("sideAssetId", () => {
  it("returns 100005160 for outcomeId=516, sideIndex=0", () => {
    // Formula: 100_000_000 + 516 * 10 + 0 = 100005160
    // Assert: sideAssetId(516, 0) === 100005160
  });

  it("returns 100005161 for outcomeId=516, sideIndex=1", () => {
    // Assert: sideAssetId(516, 1) === 100005161
  });

  it("returns 100000000 for outcomeId=0, sideIndex=0", () => {
    // Assert: sideAssetId(0, 0) === 100000000
  });

  it("returns 100013380 for outcomeId=1338, sideIndex=0", () => {
    // Assert: sideAssetId(1338, 0) === 100013380
  });
});

describe("parseSideCoin", () => {
  it("parses #5160 into outcomeId=516, sideIndex=0", () => {
    // Assert: parseSideCoin("#5160") deep equals { outcomeId: 516, sideIndex: 0 }
  });

  it("parses #5161 into outcomeId=516, sideIndex=1", () => {
    // Assert: parseSideCoin("#5161") deep equals { outcomeId: 516, sideIndex: 1 }
  });

  it("parses #13380 into outcomeId=1338, sideIndex=0", () => {
    // Assert: parseSideCoin("#13380") deep equals { outcomeId: 1338, sideIndex: 0 }
  });

  it("returns null for non-# prefix", () => {
    // Assert: parseSideCoin("BTC") === null
  });

  it("returns null for @ prefix", () => {
    // Assert: parseSideCoin("@1338") === null
  });

  it("returns null for bare # with no digits", () => {
    // Assert: parseSideCoin("#") === null
  });

  it("returns null for # with single digit (length < 2 after #)", () => {
    // Assert: parseSideCoin("#5") === null
  });

  it("returns null for empty string", () => {
    // Assert: parseSideCoin("") === null
  });

  it("returns null for # followed by non-numeric", () => {
    // Assert: parseSideCoin("#abc") has NaN check → null
  });
});

describe("parseOutcomeCoin", () => {
  it("parses @1338 into outcomeId=1338", () => {
    // Assert: parseOutcomeCoin("@1338") deep equals { outcomeId: 1338 }
  });

  it("parses @0 into outcomeId=0", () => {
    // Assert: parseOutcomeCoin("@0") deep equals { outcomeId: 0 }
  });

  it("returns null for # prefix", () => {
    // Assert: parseOutcomeCoin("#5160") === null
  });

  it("returns null for bare string", () => {
    // Assert: parseOutcomeCoin("BTC") === null
  });

  it("returns null for empty string", () => {
    // Assert: parseOutcomeCoin("") === null
  });

  it("returns null for @abc (non-numeric)", () => {
    // Assert: parseOutcomeCoin("@abc") === null (NaN check)
  });
});

describe("coinOutcomeId", () => {
  it("extracts 516 from side coin #5160", () => {
    // Assert: coinOutcomeId("#5160") === 516
  });

  it("extracts 1338 from outcome coin @1338", () => {
    // Assert: coinOutcomeId("@1338") === 1338
  });

  it("returns null for regular coin BTC", () => {
    // Assert: coinOutcomeId("BTC") === null
  });

  it("returns null for USDC", () => {
    // Assert: coinOutcomeId("USDC") === null
  });

  it("returns null for empty string", () => {
    // Assert: coinOutcomeId("") === null
  });
});

describe("isOutcomeCoin", () => {
  it("returns true for # prefix", () => {
    // Assert: isOutcomeCoin("#5160") === true
  });

  it("returns true for @ prefix", () => {
    // Assert: isOutcomeCoin("@1338") === true
  });

  it("returns false for BTC", () => {
    // Assert: isOutcomeCoin("BTC") === false
  });

  it("returns false for USDC", () => {
    // Assert: isOutcomeCoin("USDC") === false
  });

  it("returns false for empty string", () => {
    // Assert: isOutcomeCoin("") === false
  });

  it("returns false for USDH", () => {
    // Assert: isOutcomeCoin("USDH") === false
  });
});
```

**Total**: ~25 test cases

---

### 2.2 Signature Utility Tests

**File**: `tests/unit/signature-utils.test.ts`

Tests `splitHexSignature` and `normalizeSignature` from `src/adapter/hyperliquid/types.ts`.

```ts
describe("splitHexSignature", () => {
  it("splits a 0x-prefixed 130-char hex string into r, s, v", () => {
    // Setup: const hex = "0x" + "aa".repeat(32) + "bb".repeat(32) + "1b"
    // Assert: { r: "0x" + "aa".repeat(32), s: "0x" + "bb".repeat(32), v: 27 }
  });

  it("splits a hex string without 0x prefix", () => {
    // Setup: const hex = "cc".repeat(32) + "dd".repeat(32) + "1c"
    // Assert: { r: "0x" + "cc".repeat(32), s: "0x" + "dd".repeat(32), v: 28 }
  });

  it("extracts v=27 (0x1b)", () => {
    // Setup: hex ending in "1b"
    // Assert: v === 27
  });

  it("extracts v=28 (0x1c)", () => {
    // Setup: hex ending in "1c"
    // Assert: v === 28
  });

  it("handles a real-world viem signature hex", () => {
    // Setup: a known 65-byte hex signature
    // Assert: r is first 32 bytes, s is next 32, v is last byte
  });
});

describe("normalizeSignature", () => {
  it("returns HLSignature object as-is when given an object", () => {
    // Setup: const sig = { r: "0xabc...", s: "0xdef...", v: 27 }
    // Assert: normalizeSignature(sig) === sig (same reference)
  });

  it("splits hex string via splitHexSignature when given a string", () => {
    // Setup: const hex = "0x" + "aa".repeat(32) + "bb".repeat(32) + "1b"
    // Assert: normalizeSignature(hex) deep equals splitHexSignature(hex)
  });

  it("handles string without 0x prefix", () => {
    // Setup: const hex = "ff".repeat(32) + "ee".repeat(32) + "1c"
    // Assert: result.r starts with "0x", result.v === 28
  });
});
```

**Total**: 8 test cases

---

### 2.3 Event Mapping Tests

**File**: `tests/unit/event-mapping.test.ts`

Tests `HIP4EventAdapter` from `src/adapter/hyperliquid/events.ts`. Uses a mock `HIP4Client`.

```ts
describe("HIP4EventAdapter", () => {
  // Setup for all tests: create a mock HIP4Client with:
  //   fetchOutcomeMeta() → returns fixture
  //   fetchAllMids() → returns fixture

  describe("fetchCategories", () => {
    it("returns hardcoded categories array with custom and recurring", () => {
      // Assert: result has length 2
      // Assert: result[0] deep equals { id: "custom", name: "Custom", slug: "custom" }
      // Assert: result[1] deep equals { id: "recurring", name: "Recurring", slug: "recurring" }
    });

    it("does not call client (no API request)", () => {
      // Assert: client.fetchOutcomeMeta was not called
    });
  });

  describe("fetchEvents - question-based events", () => {
    it("maps an HLQuestion to a PredictionEvent with id=q{question}", () => {
      // Setup: outcomeMeta with 1 question (question=5), 2 named outcomes, 1 fallback
      // Assert: event.id === "q5"
    });

    it("sets title and description from question fields", () => {
      // Setup: question.name = "Who wins?", question.description = "Pick the winner"
      // Assert: event.title === "Who wins?", event.description === "Pick the winner"
    });

    it("sets category to 'custom' for question-based events", () => {
      // Assert: event.category === "custom"
    });

    it("creates one PredictionMarket per outcome (named + fallback)", () => {
      // Setup: question with namedOutcomes=[10, 11], fallbackOutcome=12
      // Assert: event.markets.length === 3
    });

    it("skips outcome IDs not found in the outcome map", () => {
      // Setup: question.namedOutcomes includes ID 999 that has no matching HLOutcome
      // Assert: markets only include outcomes that exist in meta.outcomes
    });

    it("sets market.id to String(outcome.outcome)", () => {
      // Setup: outcome.outcome = 516
      // Assert: market.id === "516"
    });

    it("sets market.eventId to the parent event id", () => {
      // Setup: question.question = 5
      // Assert: market.eventId === "q5"
    });

    it("creates PredictionOutcome per sideSpec with tokenId=sideCoin(outcomeId, sideIndex)", () => {
      // Setup: outcome 516 with sideSpecs [{ name: "Yes" }, { name: "No" }]
      // Assert: outcomes[0].tokenId === "#5160", outcomes[1].tokenId === "#5161"
    });

    it("sets outcome names from sideSpec.name", () => {
      // Setup: sideSpecs [{ name: "Yes" }, { name: "No" }]
      // Assert: outcomes[0].name === "Yes", outcomes[1].name === "No"
    });

    it("initializes outcome prices to '0'", () => {
      // Assert: all outcomes[*].price === "0" when mids are empty
    });

    it("sets status to 'active' when not all named outcomes are settled", () => {
      // Setup: namedOutcomes=[10, 11], settledNamedOutcomes=[10]
      // Assert: event.status === "active"
    });

    it("sets status to 'resolved' when all named outcomes are settled", () => {
      // Setup: namedOutcomes=[10, 11], settledNamedOutcomes=[10, 11]
      // Assert: event.status === "resolved"
    });

    it("sets totalVolume to '0' and endDate to ''", () => {
      // Assert: event.totalVolume === "0"
      // Assert: event.endDate === ""
    });
  });

  describe("fetchEvents - standalone outcome events", () => {
    it("creates a standalone event for outcomes not claimed by any question", () => {
      // Setup: outcome 1338 not referenced by any question
      // Assert: event.id === "o1338"
    });

    it("uses outcome.name as title for non-recurring", () => {
      // Setup: outcome.name = "My Market", outcome.description = "Some desc"
      // Assert: event.title === "My Market", event.description === "Some desc"
    });

    it("sets category to 'custom' for non-recurring standalone", () => {
      // Setup: outcome.name !== "Recurring"
      // Assert: event.category === "custom"
    });

    it("sets status to 'active' for standalone events", () => {
      // Assert: event.status === "active"
    });

    it("creates a single market for standalone events", () => {
      // Assert: event.markets.length === 1
    });
  });

  describe("fetchEvents - recurring outcomes", () => {
    it("detects recurring when outcome.name === 'Recurring'", () => {
      // Setup: outcome with name="Recurring", description="class:priceBinary|underlying:BTC|expiry:20260311-0300|targetPrice:69070|period:1d"
      // Assert: event.category === "recurring"
    });

    it("parses recurring description into title: 'BTC > $69070 (1d)'", () => {
      // Setup: priceBinary class recurring
      // Assert: event.title === "BTC > $69070 (1d)"
    });

    it("generates description: 'Will BTC be above $69070 by 20260311-0300?'", () => {
      // Assert: event.description === "Will BTC be above $69070 by 20260311-0300?"
    });

    it("extracts endDate from expiry field", () => {
      // Assert: event.endDate === "20260311-0300"
    });

    it("handles non-priceBinary class with underlying and period", () => {
      // Setup: class=rangeHigh, underlying=ETH, period=4h
      // Assert: title === "ETH rangeHigh (4h)"
    });

    it("falls back to 'Outcome #N' when description has no pipes", () => {
      // Setup: outcome.description = "just a plain string"
      // Assert: event.title === "Outcome #<outcomeId>"
    });

    it("uses raw description as event.description when parsing fails", () => {
      // Setup: description without pipes
      // Assert: event.description === outcome.description
    });

    it("handles missing fields in recurring description (??? fallbacks)", () => {
      // Setup: description = "class:priceBinary|period:1d" (no underlying, no targetPrice)
      // Assert: title includes "???"
    });
  });

  describe("fetchEvents - price enrichment", () => {
    it("enriches outcome prices from allMids for matching tokenIds", () => {
      // Setup: mids = { "#5160": "0.65", "#5161": "0.35" }
      // Assert: outcome with tokenId "#5160" has price "0.65"
    });

    it("leaves price as '0' when tokenId not in mids", () => {
      // Setup: mids = {} (empty)
      // Assert: all outcome prices remain "0"
    });

    it("gracefully handles allMids failure (catch returns {})", () => {
      // Setup: client.fetchAllMids rejects
      // Assert: events still returned, all prices "0"
    });
  });

  describe("fetchEvents - caching", () => {
    it("returns cached events within 30s TTL without re-fetching", () => {
      // Setup: call fetchEvents() twice within 30s
      // Assert: client.fetchOutcomeMeta called exactly once
    });

    it("re-fetches after cache expires (30s TTL)", () => {
      // Setup: call fetchEvents(), advance time by 31s, call again
      // Assert: client.fetchOutcomeMeta called twice
    });
  });

  describe("fetchEvents - filtering", () => {
    it("filters by category (excludes non-matching)", () => {
      // Setup: events with category "custom" and "recurring"
      // Assert: fetchEvents({ category: "recurring" }) returns only recurring
    });

    it("treats category='all' as no filter", () => {
      // Assert: fetchEvents({ category: "all" }) returns all events
    });

    it("filters active-only when active=true", () => {
      // Setup: mix of active and resolved events
      // Assert: fetchEvents({ active: true }) returns only status === "active"
    });

    it("searches by query in title (case-insensitive)", () => {
      // Setup: events with titles "BTC > $69070", "ETH prediction"
      // Assert: fetchEvents({ query: "btc" }) returns only BTC event
    });

    it("searches by query in description (case-insensitive)", () => {
      // Setup: event with description containing "ethereum"
      // Assert: fetchEvents({ query: "ETHEREUM" }) finds it
    });

    it("applies default limit=50 and offset=0", () => {
      // Setup: 60 events
      // Assert: fetchEvents() returns 50
    });

    it("respects custom limit and offset", () => {
      // Setup: 10 events
      // Assert: fetchEvents({ limit: 3, offset: 2 }) returns events at index 2, 3, 4
    });

    it("applies filters in order: category -> active -> query -> slice", () => {
      // Setup: events requiring all filters
      // Assert: combined filtering produces correct subset
    });
  });

  describe("fetchEvent", () => {
    it("returns the event matching the given eventId", () => {
      // Assert: fetchEvent("q5") returns event with id "q5"
    });

    it("throws 'HIP-4 event not found: {id}' for unknown eventId", () => {
      // Assert: fetchEvent("q999") throws Error with message "HIP-4 event not found: q999"
    });
  });
});
```

**Total**: ~35 test cases

---

### 2.4 Account Mapping Tests

**File**: `tests/unit/account-mapping.test.ts`

Tests `HIP4AccountAdapter` from `src/adapter/hyperliquid/account.ts`. Uses a mock `HIP4Client`.

```ts
describe("mapSpotBalance", () => {
  // Note: mapSpotBalance is private, so test via fetchPositions with controlled fixtures

  it("maps a #-prefixed balance to a PredictionPosition", () => {
    // Setup: balance { coin: "#5160", total: "100.5", entryNtl: "50.25" }, mids { "#5160": "0.65" }
    // Assert: position.marketId === "516", position.outcome === "Side 0"
  });

  it("maps an @-prefixed balance to a PredictionPosition", () => {
    // Setup: balance { coin: "@1338", total: "200", entryNtl: "100" }
    // Assert: position.marketId === "1338", position.outcome === "@1338" (not parseable as side coin)
  });

  it("calculates avgCost as entryNtl / total", () => {
    // Setup: total=100, entryNtl=65
    // Assert: avgCost === "0.650000"
  });

  it("sets avgCost to 0 when total is 0 (division guard)", () => {
    // Note: total=0 balances are filtered out before mapSpotBalance,
    // but the function itself guards: total !== 0 check
  });

  it("calculates unrealizedPnl as (currentPrice - avgCost) * total", () => {
    // Setup: total=100, entryNtl=50 (avgCost=0.5), mid="0.65" (currentPrice=0.65)
    // Assert: unrealizedPnl === ((0.65 - 0.5) * 100).toFixed(6) === "15.000000"
  });

  it("sets potentialPayout equal to total (outcome token face value)", () => {
    // Setup: total=100.5
    // Assert: potentialPayout === "100.500000"
  });

  it("sets currentPrice from allMids, or '0' if not found", () => {
    // Setup: mids does not contain coin
    // Assert: currentPrice === "0"
  });

  it("returns null for non-outcome coins (USDC, USDH)", () => {
    // Setup: balance.coin = "USDC"
    // Assert: filtered out (not in positions result)
  });

  it("returns null for zero-balance outcome coins", () => {
    // Setup: balance { coin: "#5160", total: "0", entryNtl: "0" }
    // Assert: filtered out
  });

  it("sets eventTitle and marketQuestion to empty strings", () => {
    // Assert: position.eventTitle === "", position.marketQuestion === ""
  });

  it("sets eventStatus to 'active'", () => {
    // Assert: position.eventStatus === "active"
  });

  it("formats shares to 6 decimal places", () => {
    // Setup: total = "1.5"
    // Assert: shares === "1.500000"
  });
});

describe("mapFill", () => {
  // Tested via fetchActivity with controlled fixtures

  it("maps an outcome-coin fill to PredictionActivity", () => {
    // Setup: fill with coin="#5160", side="B", px="0.65", sz="10", tid=12345, time=1234567890
    // Assert: { id: "12345", type: "trade", marketId: "516", outcome: "#5160", side: "buy", price: "0.65", size: "10", timestamp: 1234567890 }
  });

  it("maps side 'A' to 'sell'", () => {
    // Setup: fill.side = "A"
    // Assert: activity.side === "sell"
  });

  it("returns null for non-outcome fills (BTC, USDC)", () => {
    // Setup: fill.coin = "BTC"
    // Assert: not included in activities array
  });

  it("extracts marketId from coinOutcomeId", () => {
    // Setup: fill.coin = "@1338"
    // Assert: activity.marketId === "1338"
  });
});

describe("HIP4AccountAdapter.fetchPositions", () => {
  it("calls fetchSpotClearinghouseState and fetchAllMids in parallel", () => {
    // Setup: mock client with spy on both methods
    // Assert: both called with the provided address
  });

  it("filters to only outcome-coin balances with non-zero total", () => {
    // Setup: balances = [{ coin: "USDH", ... }, { coin: "#5160", total: "0", ... }, { coin: "#5161", total: "50", ... }]
    // Assert: positions.length === 1 (only #5161)
  });

  it("returns empty array when no outcome balances exist", () => {
    // Setup: balances = [{ coin: "USDH", total: "1000", ... }]
    // Assert: positions === []
  });
});

describe("HIP4AccountAdapter.fetchActivity", () => {
  it("fetches fills for the last 30 days", () => {
    // Setup: mock client with spy on fetchUserFillsByTime
    // Assert: startTime is approximately now - 30*24*60*60*1000, endTime is approximately now
  });

  it("filters fills to only outcome coins", () => {
    // Setup: fills include BTC fill and #5160 fill
    // Assert: activities include only the #5160 fill
  });

  it("returns empty array when no outcome fills exist", () => {
    // Setup: fills = [{ coin: "BTC", ... }]
    // Assert: activities === []
  });
});

describe("HIP4AccountAdapter.subscribePositions", () => {
  it("calls onData with positions immediately on first poll", () => {
    // Setup: mock fetchPositions to return fixture
    // Assert: onData called with positions array
  });

  it("stops polling when unsubscribe is called", () => {
    // Setup: subscribe, then immediately unsubscribe
    // Assert: after waiting > POLL_INTERVAL_MS, fetchPositions not called again
  });

  it("continues polling after fetch error (silent catch)", () => {
    // Setup: fetchPositions rejects on first call, resolves on second
    // Assert: onData eventually called with valid positions
  });
});
```

**Total**: ~22 test cases

---

### 2.5 Trading Helper Tests

**File**: `tests/unit/trading-helpers.test.ts`

Tests private helpers in `src/adapter/hyperliquid/trading.ts`: `formatPrice`, `resolveAssetId`, `mapTif`, `interpretStatus`, and the slippage/clamping logic. Since these are private, test them through `HIP4TradingAdapter.placeOrder` and `cancelOrder` with a mock client and mock signer.

```ts
describe("formatPrice", () => {
  // Test via placeOrder limit orders with controlled price values
  // Alternatively, extract and export for direct testing

  it("returns '0' for price <= 0", () => {
    // Input: 0
    // Assert: formatted price in order wire is "0"
  });

  it("returns '0' for negative price", () => {
    // Input: -5
    // Assert: "0"
  });

  it("formats price < 1 to 4 decimal places (prediction market range)", () => {
    // Input: 0.6543
    // Assert: "0.6543"
  });

  it("strips trailing zeros: 0.5000 -> '0.5'", () => {
    // Input: 0.5
    // Assert: "0.5"
  });

  it("strips trailing zeros: 0.1200 -> '0.12'", () => {
    // Input: 0.12
    // Assert: "0.12"
  });

  it("formats 0.0001 (minimum valid prediction price)", () => {
    // Input: 0.0001
    // Assert: "0.0001"
  });

  it("formats 0.9999 (maximum valid prediction price)", () => {
    // Input: 0.9999
    // Assert: "0.9999"
  });

  it("formats price >= 1 and < 10 to 2 decimal places", () => {
    // Input: 5.678
    // Assert: "5.68"
  });

  it("formats price >= 10 and < 1000 to 1 decimal place", () => {
    // Input: 42.56
    // Assert: "42.6"
  });

  it("formats price >= 1000 to integer (rounded)", () => {
    // Input: 1234.5
    // Assert: "1235"
  });

  it("strips trailing decimal point: 10.0 -> '10'", () => {
    // Input: 10.0
    // Assert: "10"
  });
});

describe("resolveAssetId", () => {
  // Test via placeOrder with different outcome string formats

  it("resolves # coin format: outcome='#5160' -> sideAssetId(516, 0)", () => {
    // Input: marketId="516", outcome="#5160"
    // Assert: asset ID in order wire === 100005160
  });

  it("resolves # coin format: outcome='#5161' -> sideAssetId(516, 1)", () => {
    // Input: marketId="516", outcome="#5161"
    // Assert: asset ID === 100005161
  });

  it("resolves trailing digit: outcome='Side 0' -> sideAssetId(516, 0)", () => {
    // Input: marketId="516", outcome="Side 0"
    // Assert: asset ID === 100005160
  });

  it("resolves trailing digit: outcome='Side 1' -> sideAssetId(516, 1)", () => {
    // Input: marketId="516", outcome="Side 1"
    // Assert: asset ID === 100005161
  });

  it("defaults to side 0 when outcome has no trailing digit", () => {
    // Input: marketId="516", outcome="Yes"
    // Assert: asset ID === 100005160
  });

  it("defaults to side 0 for empty outcome string", () => {
    // Input: marketId="516", outcome=""
    // Assert: asset ID === 100005160
  });
});

describe("mapTif", () => {
  // Test via order wire in placeOrder

  it("maps type='market' to { limit: { tif: 'FrontendMarket' } }", () => {
    // Input: type="market"
    // Assert: order wire t === { limit: { tif: "FrontendMarket" } }
  });

  it("maps type='limit', tif='GTC' to { limit: { tif: 'Gtc' } }", () => {
    // Assert: t === { limit: { tif: "Gtc" } }
  });

  it("maps type='limit', tif=undefined to { limit: { tif: 'Gtc' } }", () => {
    // Assert: t === { limit: { tif: "Gtc" } }
  });

  it("maps type='limit', tif='FOK' to { limit: { tif: 'Ioc' } }", () => {
    // Assert: t === { limit: { tif: "Ioc" } }
  });

  it("maps type='limit', tif='FAK' to { limit: { tif: 'Ioc' } }", () => {
    // Assert: t === { limit: { tif: "Ioc" } }
  });

  it("maps type='limit', tif='GTD' to { limit: { tif: 'Gtc' } }", () => {
    // Assert: t === { limit: { tif: "Gtc" } }
  });
});

describe("market order slippage calculation", () => {
  it("applies +8% slippage for buy: mid * 1.08", () => {
    // Setup: allMids returns "#5160": "0.5", side="buy"
    // Assert: price in order wire === formatPrice(0.5 * 1.08) === "0.54"
  });

  it("applies -8% slippage for sell: mid * 0.92", () => {
    // Setup: allMids returns "#5160": "0.5", side="sell"
    // Assert: price === formatPrice(0.5 * 0.92) === "0.46"
  });

  it("clamps buy price to max 0.9999", () => {
    // Setup: mid="0.95", buy -> 0.95 * 1.08 = 1.026 -> clamped to 0.9999
    // Assert: price === "0.9999"
  });

  it("clamps sell price to min 0.0001", () => {
    // Setup: mid="0.0001", sell -> 0.0001 * 0.92 = 0.000092 -> clamped to 0.0001
    // Assert: price === "0.0001"
  });

  it("returns error when no mid price found for coin", () => {
    // Setup: allMids returns empty {}
    // Assert: result.success === false, result.error contains "No mid price found"
  });
});

describe("interpretStatus", () => {
  // Test via placeOrder response handling

  it("interprets filled status with orderId, shares", () => {
    // Setup: exchange returns { filled: { totalSz: "10", avgPx: "0.65", oid: 12345 } }
    // Assert: result.status === "filled", result.orderId === "12345", result.shares === "10"
  });

  it("interprets resting status with orderId", () => {
    // Setup: exchange returns { resting: { oid: 67890 } }
    // Assert: result.status === "resting", result.orderId === "67890"
  });

  it("interprets error status with error message", () => {
    // Setup: exchange returns { error: "Insufficient balance" }
    // Assert: result.status === "error", result.error === "Insufficient balance"
  });

  it("returns status 'unknown' for unrecognized status shape", () => {
    // Setup: exchange returns {}
    // Assert: result.status === "unknown"
  });
});

describe("HIP4TradingAdapter.placeOrder", () => {
  it("returns error when not authenticated (no signer)", () => {
    // Setup: auth.getSigner() returns null
    // Assert: { success: false, error: "Not authenticated. Call auth.initAuth() first." }
  });

  it("constructs order wire with correct fields for limit buy", () => {
    // Setup: params = { marketId: "516", outcome: "#5160", side: "buy", type: "limit", price: "0.65", amount: "10" }
    // Assert: orderWire = { a: 100005160, b: true, p: "0.65", s: "10", r: false, t: { limit: { tif: "Gtc" } } }
  });

  it("constructs action with type='order', grouping='na'", () => {
    // Assert: action = { type: "order", grouping: "na", orders: [...] }
  });

  it("signs with EIP-712 domain for testnet (chainId=421614)", () => {
    // Setup: client.testnet = true
    // Assert: signer.signTypedData called with domain.chainId === 421614
  });

  it("signs with EIP-712 domain for mainnet (chainId=42161)", () => {
    // Setup: client.testnet = false
    // Assert: domain.chainId === 42161
  });

  it("returns success=false for exchange non-ok status", () => {
    // Setup: client.placeOrder returns { status: "err" }
    // Assert: { success: false, error: "Exchange returned non-ok status" }
  });

  it("returns success=false when no statuses array returned", () => {
    // Setup: response.data.statuses = []
    // Assert: { success: false, error: "No order status returned" }
  });

  it("catches signer errors and returns them as order errors", () => {
    // Setup: signer.signTypedData rejects with "User rejected"
    // Assert: { success: false, error: "User rejected" }
  });

  it("uses nonce from Date.now()", () => {
    // Setup: vi.spyOn(Date, "now").mockReturnValue(1234567890)
    // Assert: client.placeOrder called with nonce 1234567890
  });
});

describe("HIP4TradingAdapter.cancelOrder", () => {
  it("throws when not authenticated", () => {
    // Assert: rejects with "Not authenticated. Call auth.initAuth() first."
  });

  it("uses sideAssetId(outcomeId, 0) - always cancels on side 0", () => {
    // Setup: params = { marketId: "516", orderId: "12345" }
    // Assert: cancel action has a: 100005160
  });

  it("parses orderId to integer for cancel action", () => {
    // Setup: orderId = "67890"
    // Assert: cancel action has o: 67890
  });

  it("signs cancel with CANCEL_TYPES and builds cancel value", () => {
    // Assert: signer.signTypedData called with correct types
  });

  it("calls client.cancelOrder with action, nonce, signature, null", () => {
    // Assert: client.cancelOrder spy called once with correct args
  });
});

describe("HIP4TradingAdapter.cancelAllOrders", () => {
  it("throws 'cancelAllOrders is not yet supported for HIP-4 markets. Cancel orders individually.'", () => {
    // Assert: rejects with that exact message
  });
});
```

**Total**: ~38 test cases

---

### 2.6 Auth Tests

**File**: `tests/unit/auth.test.ts`

Tests `HIP4Auth` from `src/adapter/hyperliquid/auth.ts`.

```ts
describe("HIP4Auth", () => {
  describe("initial state", () => {
    it("starts with status 'disconnected'", () => {
      // Setup: new HIP4Auth()
      // Assert: getAuthStatus() === { status: "disconnected" }
    });

    it("starts with null signer", () => {
      // Assert: getSigner() === null
    });
  });

  describe("initAuth - valid signer", () => {
    it("accepts a signer with getAddress and signTypedData methods", () => {
      // Setup: mock signer = { getAddress: () => "0x...", signTypedData: async () => "0x..." }
      // Assert: does not throw
    });

    it("transitions through pending_approval to ready", () => {
      // Assert: final state.status === "ready"
    });

    it("stores the wallet address in state", () => {
      // Setup: initAuth("0xABC", validSigner)
      // Assert: state.address === "0xABC"
    });

    it("returns the final auth state", () => {
      // Assert: returned value deep equals { status: "ready", address: "0xABC" }
    });

    it("stores signer accessible via getSigner()", () => {
      // Assert: getSigner() === validSigner (same reference)
    });

    it("does NOT compare signer.getAddress() to walletAddress (agent wallet support)", () => {
      // Setup: signer.getAddress returns "0xDIFFERENT", walletAddress = "0xUSER"
      // Assert: initAuth does not throw, state.address === "0xUSER"
    });
  });

  describe("initAuth - invalid signer", () => {
    it("throws for null signer", () => {
      // Assert: rejects with "HIP-4 auth requires a signer with getAddress() and signTypedData() methods..."
    });

    it("throws for undefined signer", () => {
      // Assert: rejects with same error
    });

    it("throws for signer missing getAddress", () => {
      // Setup: { signTypedData: async () => "0x..." }
      // Assert: throws
    });

    it("throws for signer missing signTypedData", () => {
      // Setup: { getAddress: () => "0x..." }
      // Assert: throws
    });

    it("throws for non-object signer (string)", () => {
      // Assert: throws
    });

    it("throws for non-object signer (number)", () => {
      // Assert: throws
    });

    it("resets state to disconnected on invalid signer", () => {
      // Setup: try initAuth with invalid signer, catch error
      // Assert: getAuthStatus().status === "disconnected"
    });
  });

  describe("getAuthStatus", () => {
    it("returns disconnected before initAuth", () => {
      // Assert: { status: "disconnected" }
    });

    it("returns ready after successful initAuth", () => {
      // Assert: { status: "ready", address: "0x..." }
    });

    it("returns disconnected after clearAuth", () => {
      // Setup: initAuth, then clearAuth
      // Assert: { status: "disconnected" }
    });
  });

  describe("clearAuth", () => {
    it("sets signer to null", () => {
      // Setup: initAuth with valid signer, then clearAuth
      // Assert: getSigner() === null
    });

    it("sets state to disconnected", () => {
      // Assert: getAuthStatus().status === "disconnected"
    });

    it("is idempotent (can be called multiple times)", () => {
      // Assert: clearAuth() twice does not throw
    });
  });

  describe("getSigner", () => {
    it("returns null before authentication", () => {
      // Assert: getSigner() === null
    });

    it("returns the signer after authentication", () => {
      // Assert: getSigner() is the same object passed to initAuth
    });

    it("returns null after clearAuth", () => {
      // Assert: getSigner() === null
    });
  });
});
```

**Total**: ~22 test cases

---

### 2.7 Market Data Tests

**File**: `tests/unit/market-data.test.ts`

Tests `HIP4MarketDataAdapter` from `src/adapter/hyperliquid/market-data.ts`. Uses a mock `HIP4Client`.

```ts
describe("HIP4MarketDataAdapter", () => {
  describe("fetchOrderBook", () => {
    it("fetches L2 book for side 0 coin: sideCoin(outcomeId, 0)", () => {
      // Setup: marketId = "516"
      // Assert: client.fetchL2Book called with "#5160"
    });

    it("maps bids from levels[0] with price and size", () => {
      // Setup: levels = [[{ px: "0.65", sz: "100", n: 3 }], []]
      // Assert: book.bids === [{ price: "0.65", size: "100" }]
    });

    it("maps asks from levels[1] with price and size", () => {
      // Setup: levels = [[], [{ px: "0.70", sz: "50", n: 1 }]]
      // Assert: book.asks === [{ price: "0.70", size: "50" }]
    });

    it("sets marketId and timestamp from raw response", () => {
      // Setup: raw.time = 1234567890
      // Assert: book.marketId === "516", book.timestamp === 1234567890
    });

    it("handles empty book (no bids, no asks)", () => {
      // Setup: levels = [[], []]
      // Assert: book.bids === [], book.asks === []
    });

    it("maps multiple levels correctly", () => {
      // Setup: levels with 5 bids and 3 asks
      // Assert: lengths match, all price/size fields mapped
    });
  });

  describe("fetchPrice", () => {
    it("returns two-sided price for side 0 and side 1", () => {
      // Setup: allMids = { "#5160": "0.65", "#5161": "0.35" }
      // Assert: outcomes[0] = { name: "Side 0", price: "0.65", midpoint: "0.65" }
      // Assert: outcomes[1] = { name: "Side 1", price: "0.35", midpoint: "0.35" }
    });

    it("defaults to '0' when side not found in mids", () => {
      // Setup: allMids = {} (empty)
      // Assert: both sides have price "0" and midpoint "0"
    });

    it("sets marketId on the result", () => {
      // Assert: price.marketId === "516"
    });

    it("sets timestamp to current time", () => {
      // Assert: price.timestamp is close to Date.now()
    });

    it("uses 5s cached mids (does not re-fetch within TTL)", () => {
      // Setup: call fetchPrice twice within 5s
      // Assert: client.fetchAllMids called once
    });

    it("re-fetches mids after 5s cache expires", () => {
      // Setup: call fetchPrice, advance time by 6s, call again
      // Assert: client.fetchAllMids called twice
    });
  });

  describe("fetchTrades", () => {
    it("fetches trades for side 0 coin", () => {
      // Setup: marketId = "516"
      // Assert: client.fetchRecentTrades called with "#5160"
    });

    it("maps trade fields correctly: tid->id, B->buy, A->sell", () => {
      // Setup: trade = { tid: 99, coin: "#5160", side: "B", px: "0.65", sz: "10", time: 123, hash: "0x...", users: ["a", "b"] }
      // Assert: { id: "99", marketId: "516", outcome: "#5160", side: "buy", price: "0.65", size: "10", timestamp: 123 }
    });

    it("maps sell side 'A' to 'sell'", () => {
      // Setup: trade.side = "A"
      // Assert: mapped.side === "sell"
    });

    it("applies default limit of 50", () => {
      // Setup: client returns 100 trades
      // Assert: result.length === 50
    });

    it("applies custom limit", () => {
      // Setup: client returns 100 trades, limit=10
      // Assert: result.length === 10
    });

    it("returns fewer than limit if API returns fewer trades", () => {
      // Setup: client returns 3 trades, limit=50
      // Assert: result.length === 3
    });
  });

  describe("subscribeOrderBook", () => {
    it("subscribes to l2Book channel for side 0 coin", () => {
      // Assert: WS send called with { method: "subscribe", subscription: { type: "l2Book", coin: "#5160" } }
    });

    it("maps incoming l2Book data to PredictionOrderBook via onData", () => {
      // Setup: simulate WS message with channel "l2Book" and valid data
      // Assert: onData called with correctly mapped book
    });

    it("ignores data that fails isL2BookData type guard", () => {
      // Setup: simulate WS message with invalid data (no levels)
      // Assert: onData NOT called
    });

    it("returns unsubscribe function that removes the callback", () => {
      // Setup: subscribe, then call returned unsub
      // Assert: subsequent messages do not trigger onData
    });
  });

  describe("subscribePrice", () => {
    it("subscribes to allMids channel with wildcard '*'", () => {
      // Assert: WS send called with { method: "subscribe", subscription: { type: "allMids" } }
    });

    it("fires onData when relevant side coins appear in mids update", () => {
      // Setup: simulate allMids update containing "#5160": "0.7"
      // Assert: onData called with PredictionPrice containing updated value
    });

    it("does NOT fire onData when neither side coin is in mids update", () => {
      // Setup: simulate allMids update with only "BTC": "50000"
      // Assert: onData NOT called
    });

    it("defaults missing side to '0'", () => {
      // Setup: mids contains "#5160" but not "#5161"
      // Assert: outcomes[1].price === "0"
    });
  });

  describe("subscribeTrades", () => {
    it("subscribes to trades channel for side 0 coin", () => {
      // Assert: WS send called with { method: "subscribe", subscription: { type: "trades", coin: "#5160" } }
    });

    it("calls onData once per trade in the array", () => {
      // Setup: simulate trades message with array of 3 trades
      // Assert: onData called 3 times
    });

    it("ignores non-array data", () => {
      // Setup: simulate message with data = {} (not array)
      // Assert: onData NOT called
    });
  });

  describe("WebSocket pool - shared connection", () => {
    it("reuses the same WebSocket for multiple subscriptions", () => {
      // Setup: subscribeOrderBook("516", ...) and subscribePrice("516", ...)
      // Assert: only one WebSocket created
    });

    it("closes WebSocket when refCount reaches 0", () => {
      // Setup: subscribe twice, unsubscribe both
      // Assert: ws.close() called
    });

    it("keeps WebSocket open when some subscriptions remain", () => {
      // Setup: subscribe twice, unsubscribe one
      // Assert: ws.close() NOT called
    });

    it("queues subscription if WebSocket is not yet open", () => {
      // Setup: mock WS in CONNECTING state
      // Assert: subscribe message sent after open event fires
    });

    it("nullifies pool on WebSocket close", () => {
      // Setup: simulate ws.onclose
      // Assert: next subscription creates a new WebSocket
    });
  });
});
```

**Total**: ~35 test cases

---

### 2.8 Client Tests

**File**: `tests/unit/client.test.ts`

Tests `HIP4Client` from `src/adapter/hyperliquid/client.ts`. Mocks `fetch` globally.

```ts
describe("HIP4Client - constructor", () => {
  it("defaults to testnet URLs when no config provided", () => {
    // Setup: new HIP4Client()
    // Assert: infoUrl === "https://api-ui.hyperliquid-testnet.xyz/info"
    // Assert: exchangeUrl === "https://api-ui.hyperliquid-testnet.xyz/exchange"
    // Assert: wsUrl === "wss://api-ui.hyperliquid-testnet.xyz/ws"
    // Assert: testnet === true
  });

  it("defaults to testnet when testnet=true explicitly", () => {
    // Setup: new HIP4Client({ testnet: true })
    // Assert: same testnet URLs
  });

  it("uses mainnet URLs when testnet=false", () => {
    // Setup: new HIP4Client({ testnet: false })
    // Assert: infoUrl === "https://api.hyperliquid.xyz/info"
    // Assert: exchangeUrl === "https://api.hyperliquid.xyz/exchange"
    // Assert: wsUrl === "wss://api.hyperliquid.xyz/ws"
    // Assert: testnet === false
  });

  it("allows custom infoUrl override", () => {
    // Setup: new HIP4Client({ infoUrl: "http://custom/info" })
    // Assert: infoUrl === "http://custom/info"
    // Assert: exchangeUrl still defaults to testnet
  });

  it("allows custom exchangeUrl override", () => {
    // Setup: new HIP4Client({ exchangeUrl: "http://custom/exchange" })
    // Assert: exchangeUrl === "http://custom/exchange"
  });

  it("wsUrl is always derived from testnet flag (not overridable)", () => {
    // Setup: any config without wsUrl
    // Assert: wsUrl is testnet or mainnet WS URL based on testnet flag
  });
});

describe("HIP4Client - info methods", () => {
  // Setup for all: vi.stubGlobal("fetch", vi.fn())

  describe("fetchOutcomeMeta", () => {
    it("sends POST to infoUrl with { type: 'outcomeMeta' }", () => {
      // Assert: fetch called with infoUrl, method POST, body contains type: "outcomeMeta"
    });

    it("returns parsed JSON response", () => {
      // Setup: fetch resolves with { outcomes: [], questions: [] }
      // Assert: result deep equals that object
    });

    it("throws on non-OK HTTP status", () => {
      // Setup: fetch resolves with status 500
      // Assert: throws "HL info API responded with 500: Internal Server Error"
    });
  });

  describe("fetchL2Book", () => {
    it("sends POST with { type: 'l2Book', coin }", () => {
      // Assert: body === { type: "l2Book", coin: "#5160" }
    });
  });

  describe("fetchRecentTrades", () => {
    it("sends POST with { type: 'recentTrades', coin }", () => {
      // Assert: body === { type: "recentTrades", coin: "#5160" }
    });
  });

  describe("fetchAllMids", () => {
    it("sends POST with { type: 'allMids' }", () => {
      // Assert: body === { type: "allMids" }
    });
  });

  describe("fetchCandleSnapshot", () => {
    it("sends POST with { type: 'candleSnapshot', req: { coin, interval, startTime, endTime } }", () => {
      // Assert: body matches expected shape
    });
  });

  describe("fetchClearinghouseState", () => {
    it("sends POST with { type: 'clearinghouseState', user }", () => {
      // Assert: body === { type: "clearinghouseState", user: "0xABC" }
    });
  });

  describe("fetchSpotClearinghouseState", () => {
    it("sends POST with { type: 'spotClearinghouseState', user }", () => {
      // Assert: body === { type: "spotClearinghouseState", user: "0xABC" }
    });
  });

  describe("fetchUserFills", () => {
    it("sends POST with { type: 'userFills', user }", () => {
      // Assert: body === { type: "userFills", user: "0xABC" }
    });
  });

  describe("fetchUserFillsByTime", () => {
    it("sends POST with { type: 'userFillsByTime', user, startTime, endTime, aggregateByTime: true, reversed: true }", () => {
      // Assert: body includes aggregateByTime: true and reversed: true
    });
  });

  describe("fetchFrontendOpenOrders", () => {
    it("sends POST with { type: 'frontendOpenOrders', user }", () => {
      // Assert: body === { type: "frontendOpenOrders", user: "0xABC" }
    });
  });
});

describe("HIP4Client - exchange methods", () => {
  describe("placeOrder", () => {
    it("sends POST to exchangeUrl with { action, nonce, signature, vaultAddress }", () => {
      // Setup: call with mock action, nonce=123, mock signature, vaultAddress=null
      // Assert: fetch called with exchangeUrl, body matches
    });

    it("defaults vaultAddress to null", () => {
      // Assert: body includes vaultAddress: null
    });

    it("throws on non-OK HTTP status", () => {
      // Setup: fetch returns 400
      // Assert: throws "HL exchange API responded with 400: Bad Request"
    });
  });

  describe("cancelOrder", () => {
    it("sends POST to exchangeUrl with cancel action", () => {
      // Assert: body contains action.type === "cancel"
    });
  });
});

describe("HIP4Client - error handling", () => {
  it("throws on HTTP 500 from info endpoint", () => {
    // Assert: error message includes status code and statusText
  });

  it("throws on HTTP 400 from info endpoint", () => {
    // Assert: "HL info API responded with 400: Bad Request"
  });

  it("throws on HTTP 500 from exchange endpoint", () => {
    // Assert: "HL exchange API responded with 500: Internal Server Error"
  });

  it("propagates network errors (fetch rejection)", () => {
    // Setup: fetch rejects with TypeError("Failed to fetch")
    // Assert: error propagates
  });

  it("sets Content-Type: application/json for info POST", () => {
    // Assert: fetch called with headers["Content-Type"] === "application/json"
  });

  it("sets Content-Type: application/json for exchange POST", () => {
    // Assert: same header check
  });
});
```

**Total**: ~28 test cases

---

### 2.9 Factory & Adapter Composition Tests

**File**: `tests/unit/factory.test.ts`

Tests `createHIP4Adapter` from `src/adapter/factory.ts` and `HyperliquidHip4Adapter` from `src/adapter/hyperliquid/index.ts`.

```ts
describe("createHIP4Adapter", () => {
  it("returns a PredictionsAdapter with id 'hyperliquid'", () => {
    // Assert: adapter.id === "hyperliquid"
  });

  it("defaults to testnet name", () => {
    // Assert: adapter.name === "Hyperliquid HIP-4 (Testnet)"
  });

  it("uses mainnet name when testnet=false", () => {
    // Setup: createHIP4Adapter({ testnet: false })
    // Assert: adapter.name === "Hyperliquid HIP-4"
  });

  it("exposes events sub-adapter", () => {
    // Assert: adapter.events is not null, has fetchEvents, fetchEvent, fetchCategories
  });

  it("exposes marketData sub-adapter", () => {
    // Assert: adapter.marketData has fetchOrderBook, fetchPrice, fetchTrades, subscribeOrderBook, subscribePrice, subscribeTrades
  });

  it("exposes account sub-adapter", () => {
    // Assert: adapter.account has fetchPositions, fetchActivity, subscribePositions
  });

  it("exposes trading sub-adapter", () => {
    // Assert: adapter.trading has placeOrder, cancelOrder, cancelAllOrders
  });

  it("exposes auth sub-adapter", () => {
    // Assert: adapter.auth has initAuth, getAuthStatus, clearAuth
  });

  it("passes config through to client (testnet, infoUrl, exchangeUrl)", () => {
    // Setup: createHIP4Adapter({ testnet: false, infoUrl: "http://custom" })
    // Assert: adapter behaves with those URLs (verified via a network call mock)
  });

  it("defaults testnet to true when no config provided", () => {
    // Setup: createHIP4Adapter()
    // Assert: name includes "Testnet"
  });
});

describe("HyperliquidHip4Adapter.initialize", () => {
  it("calls events.fetchCategories() during initialization", () => {
    // Setup: spy on fetchCategories
    // Assert: called once
  });

  it("resolves without error", () => {
    // Assert: initialize() does not throw
  });
});

describe("HyperliquidHip4Adapter.destroy", () => {
  it("calls auth.clearAuth()", () => {
    // Setup: initAuth first, then destroy
    // Assert: getAuthStatus().status === "disconnected"
  });

  it("is safe to call multiple times", () => {
    // Assert: destroy() twice does not throw
  });
});
```

**Total**: ~14 test cases

---

## 3. Integration Tests (Live Testnet)

**Environment**: `https://api-ui.hyperliquid-testnet.xyz`
**Prerequisite**: Test wallet with USDH balance on HL testnet

### 3.1 REST Endpoint Validation

**File**: `tests/integration/rest-endpoints.test.ts`

```ts
describe("HIP4Client - live testnet", () => {
  // Setup: const client = new HIP4Client({ testnet: true })

  it("fetchOutcomeMeta returns { outcomes: [...], questions: [...] }", () => {
    // Assert: result has outcomes array and questions array
    // Assert: outcomes[0] has outcome, name, description, sideSpecs properties
  });

  it("fetchAllMids returns a Record<string, string> with # and @ coins", () => {
    // Assert: at least some keys start with "#" or "@"
  });

  it("fetchL2Book returns valid book for an active side coin", () => {
    // Setup: pick first outcome from outcomeMeta, use sideCoin(id, 0)
    // Assert: result has coin, time, levels (tuple of two arrays)
  });

  it("fetchRecentTrades returns array of HLTrade", () => {
    // Setup: pick active coin
    // Assert: array, each element has coin, side, px, sz, time, tid
  });

  it("fetchCandleSnapshot returns candle data for valid coin/interval", () => {
    // Setup: 1h interval, last 24 hours
    // Assert: array of candles with t, T, o, c, h, l, v
  });

  it("fetchSpotClearinghouseState returns balances array for test address", () => {
    // Assert: result has balances array
  });

  it("fetchUserFillsByTime returns fills array (may be empty)", () => {
    // Setup: 30-day window
    // Assert: is an array
  });

  it("fetchFrontendOpenOrders returns array (may be empty)", () => {
    // Assert: is an array
  });
});

describe("HIP4EventAdapter - live testnet", () => {
  it("fetchEvents returns non-empty array of PredictionEvent", () => {
    // Assert: events.length > 0
    // Assert: each event has id, title, category, markets, status
  });

  it("fetchEvents with category='recurring' returns only recurring events", () => {
    // Assert: every event.category === "recurring"
  });

  it("fetchEvent by ID returns matching event", () => {
    // Setup: fetch events, take first ID, then fetchEvent(id)
    // Assert: returned event.id matches
  });

  it("fetchEvent with invalid ID throws", () => {
    // Assert: rejects with "HIP-4 event not found"
  });
});

describe("HIP4MarketDataAdapter - live testnet", () => {
  it("fetchOrderBook returns valid PredictionOrderBook", () => {
    // Assert: has marketId, bids array, asks array, timestamp
  });

  it("fetchPrice returns two-sided PredictionPrice", () => {
    // Assert: outcomes.length === 2, each has name, price, midpoint
  });

  it("fetchTrades returns array of PredictionTrade", () => {
    // Assert: each has id, marketId, outcome, side, price, size, timestamp
  });
});

describe("HIP4AccountAdapter - live testnet", () => {
  it("fetchPositions returns array (may be empty for test wallet)", () => {
    // Assert: is an array
  });

  it("fetchActivity returns array of PredictionActivity", () => {
    // Assert: is an array, each has type === "trade"
  });
});
```

**Total**: ~17 test cases

### 3.2 Order Lifecycle

**File**: `tests/integration/order-lifecycle.test.ts`

**Prerequisite**: Test wallet with USDH, configured as `TEST_PRIVATE_KEY` env var.

```ts
describe("Order placement - live testnet", () => {
  // Setup:
  //   const wallet = privateKeyToAccount(process.env.TEST_PRIVATE_KEY)
  //   const adapter = createHIP4Adapter({ testnet: true })
  //   await adapter.auth.initAuth(wallet.address, wallet)
  //   Pick an active market ID from fetchEvents

  it("places a limit buy order at very low price (should rest)", () => {
    // Setup: placeOrder({ marketId, outcome: "#...0", side: "buy", type: "limit", price: "0.01", amount: "1" })
    // Assert: result.success === true, result.status === "resting", result.orderId is defined
  });

  it("cancels the resting order by orderId", () => {
    // Setup: cancelOrder({ marketId, orderId: previousOrderId })
    // Assert: does not throw
  });

  it("places a market buy order that fills (if liquidity exists)", () => {
    // Setup: placeOrder with type: "market", small amount
    // Assert: result.success === true, result.status is "filled" or "resting"
  });

  it("returns error for insufficient balance (very large amount)", () => {
    // Setup: amount = "999999999"
    // Assert: result.success === false, result.error contains error message
  });

  it("returns error when placing order with minimum size boundary", () => {
    // Setup: amount = "0.001" (may be below HL minimum)
    // Assert: either fills or returns an error - no crash
  });

  it("cancelAllOrders throws not-implemented error", () => {
    // Assert: rejects with "cancelAllOrders is not yet supported"
  });
});
```

**Total**: 6 test cases

### 3.3 WebSocket Tests

**File**: `tests/integration/websocket.test.ts`

```ts
describe("WebSocket subscriptions - live testnet", () => {
  // Setup: const adapter = createHIP4Adapter({ testnet: true })
  //        Pick active market ID

  it("subscribeOrderBook receives at least one book update within 30s", () => {
    // Setup: subscribe, collect data in array
    // Assert: at least one PredictionOrderBook received
    // Teardown: call unsub
  });

  it("subscribePrice receives at least one price update within 30s", () => {
    // Setup: subscribe to allMids
    // Assert: at least one PredictionPrice received with two outcomes
  });

  it("subscribeTrades receives trade data (if market is active)", () => {
    // Setup: subscribe for up to 60s
    // Assert: onData called (may need to skip if no trades occur)
  });

  it("unsubscribe stops receiving data", () => {
    // Setup: subscribe, collect one update, unsubscribe
    // Assert: no more updates after unsub (wait 5s)
  });

  it("multiple subscriptions share one WebSocket connection", () => {
    // Setup: subscribe to book + price
    // Assert: only one WebSocket was opened
  });

  it("WebSocket closes when all subscriptions are removed", () => {
    // Setup: subscribe twice, unsub both
    // Assert: WebSocket is closed
  });
});
```

**Total**: 6 test cases

---

## 4. E2E Tests (Playwright)

Assumes a consumer app (e.g., the `predict` app in the monorepo) is running at `localhost:3000`.

### 4.1 Event Browsing

**File**: `tests/e2e/event-browsing.spec.ts`

```ts
test.describe("Event browsing", () => {
  test("loads event list on initial page load", async ({ page }) => {
    // Navigate to predictions page
    // Assert: at least one event card is visible
  });

  test("filters events by category", async ({ page }) => {
    // Click "Recurring" category filter
    // Assert: all visible events have recurring-related content
  });

  test("searches events by keyword", async ({ page }) => {
    // Type "BTC" in search
    // Assert: visible events contain "BTC" in title or description
  });

  test("navigates to event detail on click", async ({ page }) => {
    // Click first event card
    // Assert: detail page loads with markets listed
  });

  test("event detail shows market outcomes with prices", async ({ page }) => {
    // Navigate to a known event detail
    // Assert: outcome names visible ("Yes", "No" or similar)
    // Assert: price values are displayed
  });
});
```

### 4.2 Full Trading Flow

**File**: `tests/e2e/trading-flow.spec.ts`

```ts
test.describe("Trading flow", () => {
  test("authenticates wallet via connect button", async ({ page }) => {
    // Click connect wallet
    // Assert: auth status transitions to "ready"
  });

  test("places a limit order from the trade form", async ({ page }) => {
    // Navigate to event detail
    // Select outcome, enter price and amount
    // Click place order
    // Assert: order confirmation appears (resting or filled)
  });

  test("shows pending orders in the orders list", async ({ page }) => {
    // Place a resting order
    // Assert: order appears in pending orders section
  });

  test("cancels a pending order", async ({ page }) => {
    // Click cancel on a resting order
    // Assert: order removed from pending list
  });

  test("shows positions after a fill", async ({ page }) => {
    // Place a market order (or limit at mid)
    // Assert: position appears in positions list
  });

  test("shows activity/trade history", async ({ page }) => {
    // Navigate to activity tab
    // Assert: recent trades are listed
  });
});
```

### 4.3 Real-time Data

**File**: `tests/e2e/realtime-data.spec.ts`

```ts
test.describe("Real-time data", () => {
  test("order book updates in real time", async ({ page }) => {
    // Navigate to event detail with order book component
    // Wait for initial book load
    // Assert: book updates appear (bid/ask levels change)
  });

  test("price feed updates live", async ({ page }) => {
    // Navigate to event detail
    // Record initial prices
    // Wait up to 30s for a price change
    // Assert: at least one price value changed
  });

  test("trade stream shows new trades", async ({ page }) => {
    // Navigate to event detail with trade stream
    // Assert: trades appear over time
  });
});
```

**Total E2E**: ~14 test cases

---

## 5. Fixtures & Helpers

### 5.1 Mock Client Factory

**File**: `tests/helpers/mock-client.ts`

Creates a fully stubbed `HIP4Client` with all methods returning typed fixtures.

```ts
export function createMockClient(overrides?: Partial<HIP4Client>): HIP4Client {
  return {
    infoUrl: "https://mock.test/info",
    exchangeUrl: "https://mock.test/exchange",
    wsUrl: "wss://mock.test/ws",
    testnet: true,
    fetchOutcomeMeta: vi.fn().mockResolvedValue(OUTCOME_META_FIXTURE),
    fetchAllMids: vi.fn().mockResolvedValue(ALL_MIDS_FIXTURE),
    fetchL2Book: vi.fn().mockResolvedValue(L2_BOOK_FIXTURE),
    fetchRecentTrades: vi.fn().mockResolvedValue(TRADES_FIXTURE),
    fetchCandleSnapshot: vi.fn().mockResolvedValue([]),
    fetchClearinghouseState: vi.fn().mockResolvedValue(CLEARINGHOUSE_FIXTURE),
    fetchSpotClearinghouseState: vi
      .fn()
      .mockResolvedValue(SPOT_CLEARINGHOUSE_FIXTURE),
    fetchUserFills: vi.fn().mockResolvedValue([]),
    fetchUserFillsByTime: vi.fn().mockResolvedValue(FILLS_FIXTURE),
    fetchFrontendOpenOrders: vi.fn().mockResolvedValue([]),
    placeOrder: vi.fn().mockResolvedValue(ORDER_SUCCESS_FIXTURE),
    cancelOrder: vi.fn().mockResolvedValue({ status: "ok" }),
    ...overrides,
  } as unknown as HIP4Client;
}
```

### 5.2 Mock Signer

**File**: `tests/helpers/mock-signer.ts`

```ts
/** Valid signer that returns a predictable hex signature */
export function createMockSigner(address = "0x1234"): HIP4Signer {
  return {
    getAddress: () => address,
    signTypedData: vi.fn().mockResolvedValue({
      r: "0x" + "aa".repeat(32),
      s: "0x" + "bb".repeat(32),
      v: 27,
    }),
  };
}

/** Signer that rejects with a user rejection error */
export function createRejectingSigner(): HIP4Signer {
  return {
    getAddress: () => "0xREJECT",
    signTypedData: vi
      .fn()
      .mockRejectedValue(new Error("User rejected the request")),
  };
}

/** Invalid signer missing signTypedData */
export function createInvalidSigner(): Record<string, unknown> {
  return {
    getAddress: () => "0xINVALID",
    // signTypedData intentionally missing
  };
}
```

### 5.3 Typed Fixtures

**File**: `tests/fixtures/outcome-meta.ts`

```ts
export const OUTCOME_META_FIXTURE: HLOutcomeMeta = {
  outcomes: [
    {
      outcome: 516,
      name: "Will BTC hit $100k?",
      description: "Bitcoin price prediction",
      sideSpecs: [{ name: "Yes" }, { name: "No" }],
    },
    {
      outcome: 517,
      name: "Recurring",
      description:
        "class:priceBinary|underlying:BTC|expiry:20260311-0300|targetPrice:69070|period:1d",
      sideSpecs: [{ name: "Yes" }, { name: "No" }],
    },
    {
      outcome: 518,
      name: "Fallback outcome",
      description: "Fallback for question",
      sideSpecs: [{ name: "Other" }, { name: "None" }],
    },
  ],
  questions: [
    {
      question: 5,
      name: "BTC Predictions",
      description: "Group of BTC predictions",
      fallbackOutcome: 518,
      namedOutcomes: [516],
      settledNamedOutcomes: [],
    },
  ],
};
```

**File**: `tests/fixtures/all-mids.ts`

```ts
export const ALL_MIDS_FIXTURE: Record<string, string> = {
  "#5160": "0.65",
  "#5161": "0.35",
  "#5170": "0.42",
  "#5171": "0.58",
  "@516": "0.5",
};
```

**File**: `tests/fixtures/l2-book.ts`

```ts
export const L2_BOOK_FIXTURE: HLL2Book = {
  coin: "#5160",
  time: 1711100000000,
  levels: [
    [
      { px: "0.64", sz: "100", n: 5 },
      { px: "0.63", sz: "200", n: 3 },
    ],
    [
      { px: "0.66", sz: "150", n: 4 },
      { px: "0.67", sz: "80", n: 2 },
    ],
  ],
};
```

**File**: `tests/fixtures/trades.ts`

```ts
export const TRADES_FIXTURE: HLTrade[] = [
  {
    coin: "#5160",
    side: "B",
    px: "0.65",
    sz: "10",
    time: 1711100000000,
    hash: "0xabc123",
    tid: 99001,
    users: ["0xBuyer", "0xSeller"],
  },
  {
    coin: "#5160",
    side: "A",
    px: "0.64",
    sz: "5",
    time: 1711099999000,
    hash: "0xdef456",
    tid: 99002,
    users: ["0xSeller2", "0xBuyer2"],
  },
];
```

**File**: `tests/fixtures/spot-clearinghouse.ts`

```ts
export const SPOT_CLEARINGHOUSE_FIXTURE: HLSpotClearinghouseState = {
  balances: [
    { coin: "USDH", token: 0, hold: "0", total: "1000", entryNtl: "1000" },
    { coin: "#5160", token: 100, hold: "0", total: "50", entryNtl: "32.5" },
    { coin: "#5161", token: 101, hold: "0", total: "0", entryNtl: "0" },
    { coin: "@516", token: 102, hold: "0", total: "20", entryNtl: "10" },
  ],
};
```

**File**: `tests/fixtures/fills.ts`

```ts
export const FILLS_FIXTURE: HLFill[] = [
  {
    coin: "#5160",
    px: "0.65",
    sz: "10",
    side: "B",
    time: 1711100000000,
    startPosition: "0",
    dir: "Open Long",
    closedPnl: "0",
    hash: "0xfill1",
    oid: 12345,
    crossed: true,
    fee: "0.001",
    tid: 88001,
    feeToken: "USDH",
  },
  {
    coin: "BTC",
    px: "50000",
    sz: "0.1",
    side: "B",
    time: 1711099000000,
    startPosition: "0",
    dir: "Open Long",
    closedPnl: "0",
    hash: "0xfill2",
    oid: 12346,
    crossed: false,
    fee: "0.5",
    tid: 88002,
    feeToken: "USDC",
  },
];
```

**File**: `tests/fixtures/exchange-responses.ts`

```ts
export const ORDER_SUCCESS_FIXTURE: HLExchangeResponse = {
  status: "ok",
  response: {
    type: "order",
    data: {
      statuses: [{ resting: { oid: 12345 } }],
    },
  },
};

export const ORDER_FILLED_FIXTURE: HLExchangeResponse = {
  status: "ok",
  response: {
    type: "order",
    data: {
      statuses: [{ filled: { totalSz: "10", avgPx: "0.65", oid: 12345 } }],
    },
  },
};

export const ORDER_ERROR_FIXTURE: HLExchangeResponse = {
  status: "ok",
  response: {
    type: "order",
    data: {
      statuses: [{ error: "Insufficient balance" }],
    },
  },
};

export const EXCHANGE_ERR_FIXTURE: HLExchangeResponse = {
  status: "err",
};
```

**File**: `tests/fixtures/frontend-orders.ts`

```ts
export const FRONTEND_ORDERS_FIXTURE: HLFrontendOrder[] = [
  {
    coin: "#5160",
    side: "B",
    limitPx: "0.60",
    sz: "10",
    oid: 12345,
    timestamp: 1711100000000,
    origSz: "10",
    reduceOnly: false,
    orderType: "Limit",
    tif: "Gtc",
    cloid: null,
  },
];
```

### 5.4 Test Wallet Utility

**File**: `tests/helpers/test-wallet.ts`

```ts
import { privateKeyToAccount } from "viem/accounts";

/**
 * Creates a test wallet from the TEST_PRIVATE_KEY env var.
 * Used only in integration tests.
 */
export function getTestWallet() {
  const pk = process.env.TEST_PRIVATE_KEY;
  if (!pk)
    throw new Error("TEST_PRIVATE_KEY env var required for integration tests");
  const account = privateKeyToAccount(pk as `0x${string}`);
  return {
    address: account.address,
    signer: {
      getAddress: () => account.address,
      signTypedData: async (
        domain: Record<string, unknown>,
        types: Record<string, Array<{ name: string; type: string }>>,
        value: Record<string, unknown>,
      ) => {
        // Use viem's signTypedData which returns hex
        // The adapter's normalizeSignature will split it
        return account.signTypedData({
          domain: domain as any,
          types: types as any,
          primaryType: Object.keys(types)[0],
          message: value as any,
        });
      },
    },
  };
}
```

---

## 6. CI/CD

### GitHub Actions Workflow

**File**: `.github/workflows/test.yml`

```yaml
name: Tests

on:
  pull_request:
    paths:
      - "src/**"
      - "tests/**"
      - "package.json"
      - "vitest.config.ts"
  push:
    branches: [main]
  schedule:
    - cron: "0 3 * * *" # E2E nightly at 3 AM UTC

jobs:
  unit:
    name: Unit Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx vitest run tests/unit/
      - run: npx vitest run tests/unit/ --coverage
    timeout-minutes: 10

  integration:
    name: Integration Tests (Testnet)
    runs-on: ubuntu-latest
    if: github.event_name == 'push' || github.event_name == 'schedule'
    needs: unit
    env:
      TEST_PRIVATE_KEY: ${{ secrets.HL_TESTNET_PRIVATE_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx vitest run tests/integration/
    timeout-minutes: 5

  e2e:
    name: E2E Tests (Playwright)
    runs-on: ubuntu-latest
    if: github.event_name == 'schedule'
    needs: integration
    env:
      TEST_PRIVATE_KEY: ${{ secrets.HL_TESTNET_PRIVATE_KEY }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npm start &
      - run: npx playwright test tests/e2e/
    timeout-minutes: 15
```

### Secrets Required

| Secret                   | Description                                           |
| ------------------------ | ----------------------------------------------------- |
| `HL_TESTNET_PRIVATE_KEY` | Private key for a test wallet with USDH on HL testnet |

### Timeout Configuration

| Test Suite        | Vitest/Playwright Timeout | CI Job Timeout |
| ----------------- | ------------------------- | -------------- |
| Unit tests        | 5s per test (default)     | 10 min         |
| Integration tests | 30s per test              | 5 min          |
| E2E tests         | 60s per test              | 15 min         |

---

## 7. Coverage

### Target

- **90%+ line coverage** on the adapter layer (`src/adapter/**/*.ts`)
- **85%+ branch coverage** (to account for error paths that require network failures)
- Types file (`src/adapter/hyperliquid/types.ts`) excluded from coverage (pure type definitions + two small utility functions covered separately)
- Hooks (`src/hooks/**`) excluded from unit coverage (tested via E2E)

### Per-File Expectations

| File                   | Target Lines | Critical Paths                                                                                                                                                       |
| ---------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `client.ts`            | 95%+         | All fetch methods, error handling, URL resolution                                                                                                                    |
| `events.ts`            | 95%+         | buildEventsFromMeta, question mapping, standalone mapping, recurring parsing, cache TTL, filtering, price enrichment                                                 |
| `market-data.ts`       | 90%+         | fetchOrderBook, fetchPrice, fetchTrades, mids cache, WS subscription/unsubscription                                                                                  |
| `account.ts`           | 95%+         | mapSpotBalance, mapFill, fetchPositions filtering, fetchActivity 30-day range, subscribePositions polling                                                            |
| `trading.ts`           | 95%+         | formatPrice all branches, resolveAssetId all paths, mapTif all cases, placeOrder full flow (auth check, market/limit, sign, interpret), cancelOrder, cancelAllOrders |
| `auth.ts`              | 100%         | initAuth valid/invalid, getAuthStatus, clearAuth, getSigner, isHIP4Signer                                                                                            |
| `factory.ts`           | 100%         | createHIP4Adapter with/without config                                                                                                                                |
| `hyperliquid/index.ts` | 100%         | constructor, initialize, destroy                                                                                                                                     |

### Critical Paths That Must Not Regress

These are the paths where a regression would cause user-facing failures or financial errors:

1. **formatPrice** - incorrect formatting causes order rejection or wrong prices
2. **resolveAssetId** - wrong asset ID sends orders to the wrong market
3. **mapTif** - wrong TIF causes unexpected order behavior
4. **sideAssetId / sideCoin** - wrong coin naming breaks all API calls
5. **normalizeSignature / splitHexSignature** - wrong signature format causes auth failure
6. **placeOrder auth check** - must block orders when not authenticated
7. **market order slippage clamping** - prices outside [0.0001, 0.9999] are invalid
8. **fetchPositions outcome-coin filter** - must not show USDH/USDC as prediction positions
9. **fetchActivity outcome-coin filter** - must not show perp fills as prediction activity
10. **event cache TTL** - stale data beyond 30s causes incorrect event listings

### Running Coverage

```bash
npx vitest run --coverage
```

Coverage reports are generated in `coverage/` directory. The CI pipeline fails if thresholds are not met (configured in `vitest.config.ts`).
