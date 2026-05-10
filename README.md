# @perps/hip4

TypeScript SDK for HIP-4 prediction markets on Hyperliquid. Zero runtime dependencies.

```bash
pnpm add @perps/hip4
```

## Setup

```typescript
import { createHIP4Adapter } from "@perps/hip4";

const hip4 = createHIP4Adapter({ testnet: true });
await hip4.initialize();
```

## Usage

### Events

```typescript
const events = await hip4.events.fetchEvents({ active: true });
const event = await hip4.events.fetchEvent("q1");
const categories = await hip4.events.fetchCategories();
```

### Market Data

```typescript
const book = await hip4.marketData.fetchOrderBook("516", 0);
const price = await hip4.marketData.fetchPrice("516");
const trades = await hip4.marketData.fetchTrades("516", 20);
const candles = await hip4.marketData.fetchCandles("516", "1h");

// WebSocket
const unsub = hip4.marketData.subscribeOrderBook("516", (book) => { /* ... */ });
const unsub2 = hip4.marketData.subscribePrice("516", (price) => { /* ... */ });
const unsub3 = hip4.marketData.subscribeTrades("516", (trade) => { /* ... */ });
```

### Account

```typescript
const positions = await hip4.account.fetchPositions(address);
const activity = await hip4.account.fetchActivity(address);
const balances = await hip4.account.fetchBalance(address);
const orders = await hip4.account.fetchOpenOrders(address);

const unsub = hip4.account.subscribePositions(address, (positions) => { /* ... */ });
```

### Auth

Approve an ephemeral agent key, then all subsequent trades are signed without wallet popups.

```typescript
import { getAgentApprovalTypedData, submitAgentApproval } from "@perps/hip4";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";

const agentKey = generatePrivateKey();
const agent = privateKeyToAccount(agentKey);
const typedData = getAgentApprovalTypedData(agent.address, "My App", Date.now(), false);
const sig = await walletClient.signTypedData(typedData);
await submitAgentApproval(sig, agent.address, "My App", Date.now(), false);
await hip4.auth.initAuth(userAddress, agent);
```

### Trading

```typescript
const result = await hip4.trading.placeOrder({
  marketId: "516",
  outcome: "#5160",
  side: "buy",
  type: "limit",
  price: "0.65",
  amount: "100",
});

await hip4.trading.cancelOrder({ marketId: "516", orderId: "12345", outcome: "#5160" });
```

Market orders use `FrontendMarket` TIF.

### Wallet

Two signers: user wallet (via `setSigner`) for EIP-712 transfers/withdrawals, agent key for USDH spot trades.

```typescript
hip4.wallet.setSigner({
  address: userAddress,
  signTypedData: walletClient.signTypedData.bind(walletClient),
});

// Deposit: Perp -> Spot -> buy USDH
await hip4.wallet.transferToSpot("100");
await hip4.wallet.buyUsdh("100");

// Withdraw: sell USDH -> Spot -> Perp -> external
await hip4.wallet.sellUsdh("50");
await hip4.wallet.transferToPerps("50");
await hip4.wallet.withdraw({ destination: "0x...", amount: "50" });

// Send USDC to another HL address
await hip4.wallet.usdSend({ destination: "0x...", amount: "25" });
```

USDH spot orders price at oracle +/-10% with `Ioc` TIF. Returns `{ success, filledSz?, avgPx? }`.

---

## Signing

Both HL signing flows are implemented from scratch with no external dependencies.

**L1 agent signing** (orders, cancels, USDH spot):

1. Sort action keys in canonical order
2. MessagePack encode
3. Append nonce as BE u64
4. Append vault marker byte
5. Keccak-256 hash -> `connectionId`
6. EIP-712 sign with `Agent` type on chainId `1337`

Msgpack and keccak-256 are inline implementations.

**User-signed EIP-712** (transfers, withdrawals, sends):

- Domain: `HyperliquidSignTransaction`, `signatureChainId: 0x66eee`
- Message filtered to EIP-712 type keys only (wallet compatibility)
- Requires actual user wallet - agent keys rejected

## API Reference

### `adapter.events`

| Method | Description |
|--------|-------------|
| `fetchEvents(params?)` | List events. Filters: `category`, `active`, `limit`, `offset`, `query` |
| `fetchEvent(eventId)` | Single event by ID |
| `fetchCategories()` | Returns `[{ id, name, slug }]` |

### `adapter.marketData`

| Method | Description |
|--------|-------------|
| `fetchOrderBook(marketId, sideIndex?)` | L2 snapshot |
| `fetchPrice(marketId)` | Both sides from allMids, 5s cache |
| `fetchTrades(marketId, limit?)` | Recent trades |
| `fetchCandles(marketId, interval?, start?, end?)` | OHLCV candles |
| `subscribeOrderBook(marketId, cb)` | Real-time L2 book |
| `subscribePrice(marketId, cb)` | Real-time prices |
| `subscribeTrades(marketId, cb)` | Real-time trades |

### `adapter.account`

| Method | Description |
|--------|-------------|
| `fetchPositions(address)` | Outcome positions with resolved side names |
| `fetchActivity(address)` | Fills, last 30 days |
| `fetchBalance(address)` | Raw spot balances |
| `fetchOpenOrders(address)` | Resting orders |
| `subscribePositions(address, cb)` | Polling at 10s |

### `adapter.trading`

| Method | Description |
|--------|-------------|
| `placeOrder(params)` | `{ marketId, outcome, side, type, price?, amount }`. Returns `{ success, orderId?, error? }` |
| `cancelOrder(params)` | `{ marketId, orderId, outcome }`. Throws on failure |

### `adapter.wallet`

| Method | Signing | Description |
|--------|---------|-------------|
| `setSigner(signer)` | - | Set user wallet for EIP-712 ops |
| `buyUsdh(amount)` | L1 agent | Buy USDH at oracle +/-10%, Ioc |
| `sellUsdh(amount)` | L1 agent | Sell USDH at oracle +/-10%, Ioc |
| `transferToSpot(amount)` | EIP-712 | Perp -> Spot |
| `transferToPerps(amount)` | EIP-712 | Spot -> Perp |
| `withdraw({ destination, amount })` | EIP-712 | Withdraw to external address |
| `usdSend({ destination, amount })` | EIP-712 | Send to another HL address |

### `adapter.auth`

| Method | Description |
|--------|-------------|
| `initAuth(walletAddress, signer)` | Accepts viem `PrivateKeyAccount` or ethers `Signer` |
| `getAuthStatus()` | `"disconnected" \| "pending_approval" \| "ready"` |
| `clearAuth()` | Reset |

## Acknowledgements

Signing implementation inspired by [@nktkas/hyperliquid](https://github.com/nktkas/hyperliquid).

## License

BUSL-1.1
