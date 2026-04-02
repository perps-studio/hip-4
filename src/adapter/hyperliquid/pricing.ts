// ---------------------------------------------------------------------------
// HIP-4 Pricing Utilities
//
// Tick size computation (5 significant figures), price formatting with
// trailing-zero stripping, and minimum order size calculation.
//
// The exchange strips trailing zeros before msgpack hashing.
// Sending "0.650" when the server hashes "0.65" produces a different hash,
// causing wrong signer recovery. Always use formatPrice() or stripZeros()
// for any value in a signed payload.
// ---------------------------------------------------------------------------

/**
 * Minimum order notional value: 10 USDH.
 * The exchange enforces: size × min(markPx, 1 − markPx) ≥ 10 USDH.
 */
export const MIN_NOTIONAL = 10;

// ---------------------------------------------------------------------------
// Tick size
// ---------------------------------------------------------------------------

/**
 * Compute the tick size for a given price (5 significant figures).
 *
 * Formula: tick = 10^(floor(log10(price)) − 4)
 *
 * Examples:
 *   price 0.55  → tick 0.00001
 *   price 1.0   → tick 0.0001
 *   price 65000 → tick 1
 */
export function computeTickSize(price: number): number {
  if (price <= 0) return 0.00001;
  return Math.pow(10, Math.floor(Math.log10(price)) - 4);
}

/** Round a price to the nearest valid tick. */
export function roundToTick(price: number): number {
  const tick = computeTickSize(price);
  return Math.round(price / tick) * tick;
}

// ---------------------------------------------------------------------------
// Price formatting
// ---------------------------------------------------------------------------

/**
 * Format a price for signing: round to tick size, then strip trailing zeros.
 *
 * The exchange strips trailing zeros before msgpack hashing.
 * Sending "0.650" when the server hashes "0.65" produces a different hash,
 * which causes the wrong signer address to be recovered.
 */
export function formatPrice(price: number): string {
  if (price <= 0) return "0";
  const rounded = roundToTick(price);
  const tick = computeTickSize(rounded);
  const decimals = Math.max(0, -Math.floor(Math.log10(tick)));
  let s = rounded.toFixed(decimals);
  if (s.includes(".")) {
    s = s.replace(/\.?0+$/, "");
  }
  return s;
}

/**
 * Strip trailing zeros from a numeric string.
 *
 * Examples: "35.810" → "35.81", "1.0" → "1", "0.650" → "0.65"
 */
export function stripZeros(s: string): string {
  if (!s.includes(".")) return s;
  return s.replace(/\.?0+$/, "");
}

// ---------------------------------------------------------------------------
// Minimum order size
// ---------------------------------------------------------------------------

/**
 * Calculate the minimum order size (in shares) for a prediction market coin.
 *
 * The exchange enforces:
 *   size × min(markPx, 1 − markPx) ≥ 10 USDH
 *
 * Solving for size:
 *   size ≥ 10 / min(markPx, 1 − markPx)
 *
 * Edge-case: markPx at or beyond 0 or 1 is clamped to 0.01.
 */
export function getMinShares(markPx: number): number {
  const effectivePx = Math.max(Math.min(markPx, 1 - markPx), 0.01);
  return Math.ceil(MIN_NOTIONAL / effectivePx);
}
