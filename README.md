<h1 align="center">@perps/hip4</h1>

<p align="center">
  <a href="https://www.npmjs.com/package/@perps/hip4"><img src="https://img.shields.io/npm/v/@perps/hip4.svg" alt="npm version" /></a>
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen" alt="zero dependencies" />
  <img src="https://img.shields.io/npm/l/@perps/hip4" alt="license" />
</p>

---

TypeScript SDK for Hyperliquid HIP-4 prediction markets. Zero runtime dependencies.

## Built for developers

The SDK is structured around a single adapter with typed sub-modules for each domain - events, market data, account state, trading, wallet, and auth. Everything returns typed responses, WebSocket subscriptions return unsubscribe functions, and all signing (L1 agent + EIP-712) is handled internally with no external crypto dependencies.

```bash
pnpm add @perps/hip4
```

```typescript
import { createHIP4Adapter } from "@perps/hip4";

const hip4 = createHIP4Adapter({ testnet: true });
await hip4.initialize();
```

## Examples

- [`auth-eoa.ts`](examples/auth-eoa.ts) - Agent key approval and auth setup
- [`get-all-markets.ts`](examples/get-all-markets.ts) - Fetch all markets grouped by type
- [`get-multi-outcome.ts`](examples/get-multi-outcome.ts) - Multi-outcome markets with live prices
- [`get-recurring-markets.ts`](examples/get-recurring-markets.ts) - Recurring markets with expiry countdowns
- [`place-limit-order.ts`](examples/place-limit-order.ts) - Limit order with price validation
- [`place-market-order.ts`](examples/place-market-order.ts) - Market order with FrontendMarket TIF
- [`stream-prices.ts`](examples/stream-prices.ts) - Stream live prices via WebSocket

## API

### `hip4.events`

| Method | Description |
|--------|-------------|
| `fetchEvents(params?)` | List events. Filters: `category`, `active`, `limit`, `offset`, `query` |
| `fetchEvent(eventId)` | Single event by ID |
| `fetchCategories()` | Available categories |
| `fetchMarkets(params?)` | Typed HIP-4 markets with optional grouping by type or question |

### `hip4.marketData`

| Method | Description |
|--------|-------------|
| `fetchOrderBook(marketId, sideIndex?)` | L2 snapshot |
| `fetchPrice(marketId)` | Both sides, 5s cache |
| `fetchTrades(marketId, limit?)` | Recent trades |
| `fetchCandles(marketId, interval?, start?, end?)` | OHLCV candles |
| `subscribeOrderBook(marketId, cb)` | Real-time L2 book |
| `subscribePrice(marketId, cb)` | Real-time prices |
| `subscribeTrades(marketId, cb)` | Real-time trades |

### `hip4.account`

| Method | Description |
|--------|-------------|
| `fetchPositions(address)` | Outcome positions with resolved side names |
| `fetchActivity(address)` | Fills, last 30 days |
| `fetchBalance(address)` | Spot balances |
| `fetchOpenOrders(address)` | Resting orders |
| `subscribePositions(address, cb)` | Polling at 10s |

### `hip4.trading`

| Method | Description |
|--------|-------------|
| `placeOrder(params)` | Place market or limit order. Returns `{ success, orderId?, error? }` |
| `cancelOrder(params)` | Cancel a resting order |

### `hip4.wallet`

| Method | Signing | Description |
|--------|---------|-------------|
| `setSigner(signer)` | - | Set user wallet for EIP-712 ops |
| `buyUsdh(amount)` | L1 agent | Buy USDH on spot |
| `sellUsdh(amount)` | L1 agent | Sell USDH on spot |
| `transferToSpot(amount)` | EIP-712 | Perp -> Spot |
| `transferToPerps(amount)` | EIP-712 | Spot -> Perp |
| `withdraw({ destination, amount })` | EIP-712 | Withdraw to external address |
| `usdSend({ destination, amount })` | EIP-712 | Send to another HL address |

### `hip4.auth`

| Method | Description |
|--------|-------------|
| `initAuth(walletAddress, signer)` | Accepts viem `PrivateKeyAccount` or ethers `Signer` |
| `getAuthStatus()` | `"disconnected" \| "pending_approval" \| "ready"` |
| `clearAuth()` | Reset auth state |

## Signing

Both Hyperliquid signing flows are implemented from scratch.

**L1 agent signing** (orders, cancels, USDH spot):

1. Sort action keys in canonical order
2. MessagePack encode
3. Append nonce as BE u64
4. Append vault marker byte
5. Keccak-256 hash -> `connectionId`
6. EIP-712 sign with `Agent` type on chainId `1337`

**User-signed EIP-712** (transfers, withdrawals, sends):

- Domain: `HyperliquidSignTransaction`, `signatureChainId: 0x66eee`
- Message filtered to EIP-712 type keys only
- Requires user wallet, agent keys rejected

## Acknowledgements

Signing implementation inspired by [@nktkas/hyperliquid](https://github.com/nktkas/hyperliquid).

## License

BUSL-1.1
