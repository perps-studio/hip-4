// ---------------------------------------------------------------------------
// HIP-4 Trading Adapter
//
// Places/cancels orders via the HL exchange endpoint. Orders target
// per-side coins (#<outcomeId><sideIndex>) using standard HL order format.
//
// Asset ID mapping: 100_000_000 + outcomeId * 10 + sideIndex
// ---------------------------------------------------------------------------

import type {
  PredictionCancelParams,
  PredictionOrderParams,
  PredictionOrderResult,
} from "../../types/trading";
import type { PredictionTradingAdapter } from "../types";
import type { HIP4Auth } from "./auth";
import type { HIP4Client } from "./client";
import { sideAssetId } from "./client";
import { formatPrice, stripZeros, getMinShares, MIN_NOTIONAL } from "./pricing";
import { signL1Action, sortCancelAction, sortOrderAction } from "./signing";
import {
  type HLCancelAction,
  type HLOrderAction,
  type HLOrderStatus,
  type HLOrderWire,
} from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapTif(
  type: PredictionOrderParams["type"],
  tif?: PredictionOrderParams["timeInForce"],
): HLOrderWire["t"] {
  if (type === "market") {
    return { limit: { tif: "FrontendMarket" } };
  }
  switch (tif) {
    case "FOK":
      // NOTE: HL does not support true Fill-or-Kill. This maps to Immediate-or-Cancel (Ioc),
      // which may result in partial fills. Consumers expecting all-or-nothing semantics
      // should validate fill size in the response.
      return { limit: { tif: "Ioc" } };
    case "FAK":
      return { limit: { tif: "Ioc" } };
    case "GTD":
    case "GTC":
    case undefined:
    default:
      return { limit: { tif: "Gtc" } };
  }
}

/**
 * Resolve outcome string to HL asset ID.
 *
 * Resolution order:
 *   1. "#<outcomeId><sideIndex>" - explicit side coin format (most precise)
 *   2. Trailing digit regex - infers sideIndex from last char (e.g. "Yes0" → 0, "No1" → 1)
 *   3. Fallback → side 0 ("Yes"). This means bare "No" without a trailing digit
 *      will resolve to side 0, NOT side 1. Callers that care about the No side
 *      must pass an explicit sideIndex (e.g. "No1" or "#<id>1").
 *
 * TODO: Consider making this stricter - require explicit side index and remove
 *       the regex fallback once all callers are updated.
 */
function resolveAssetId(marketId: string, outcome: string): number {
  const outcomeId = parseInt(marketId, 10);

  if (outcome.startsWith("#") || outcome.startsWith("+")) {
    const num = outcome.slice(1);
    const sideIndex = parseInt(num.slice(-1), 10);
    if (sideIndex !== 0 && sideIndex !== 1) {
      throw new Error(`Invalid sideIndex ${sideIndex} in outcome "${outcome}". Must be 0 or 1.`);
    }
    return sideAssetId(outcomeId, sideIndex);
  }

  const sideMatch = /(\d)$/.exec(outcome);
  if (sideMatch?.[1]) {
    const sideIndex = parseInt(sideMatch[1], 10);
    if (sideIndex > 1) {
      return sideAssetId(outcomeId, 0); // Fallback: ambiguous trailing digit, default to side 0
    }
    return sideAssetId(outcomeId, sideIndex);
  }

  return sideAssetId(outcomeId, 0);
}

function interpretStatus(
  status: HLOrderStatus,
): Pick<PredictionOrderResult, "orderId" | "status" | "shares" | "error"> {
  if ("filled" in status) {
    return {
      orderId: String(status.filled.oid),
      status: "filled",
      shares: status.filled.totalSz,
    };
  }
  if ("resting" in status) {
    return {
      orderId: String(status.resting.oid),
      status: "resting",
    };
  }
  if ("error" in status) {
    return {
      error: status.error,
      status: "error",
    };
  }
  return { status: "unknown" };
}

// ---------------------------------------------------------------------------
// HIP4TradingAdapter
// ---------------------------------------------------------------------------

export class HIP4TradingAdapter implements PredictionTradingAdapter {
  constructor(
    private readonly client: HIP4Client,
    private readonly auth: HIP4Auth,
  ) {}

  async placeOrder(
    params: PredictionOrderParams,
  ): Promise<PredictionOrderResult> {
    const signer = this.auth.getSigner();
    if (!signer) {
      return {
        success: false,
        error: "Not authenticated. Call auth.initAuth() first.",
      };
    }

    const assetId = resolveAssetId(params.marketId, params.outcome);
    const isBuy = params.side === "buy";
    const amount = stripZeros(params.amount);

    // Resolve price: market orders use FrontendMarket TIF with best-execution pricing
    let price: string;
    if (params.type === "market") {
      // With FrontendMarket TIF, the exchange handles best-execution.
      // Use extreme prices to ensure fill.
      price = isBuy ? "0.99999" : "0.00001";

      this.client.log(
        "debug",
        `Market order: side=${isBuy ? "buy" : "sell"}, price=${price} (FrontendMarket best-execution)`,
      );
    } else {
      // Limit order - format the provided price with tick alignment
      const rawPrice = parseFloat(params.price ?? "0");
      price = formatPrice(rawPrice);
      this.client.log("debug", `Limit order: price=${price}`);

      // Pre-submission validation for limit orders
      const numericPrice = parseFloat(price);
      const numericSize = parseFloat(amount);

      // Minimum shares check (when mark price provided)
      if (params.markPx !== undefined) {
        const minShares = getMinShares(params.markPx);
        if (numericSize < minShares) {
          return {
            success: false,
            error: `Size ${numericSize} below minimum ${minShares} shares (markPx=${params.markPx})`,
          };
        }
      }

      // Notional check: exchange uses size × min(markPx, 1 - markPx) >= 10.
      // When markPx is available, use the exchange formula. Otherwise fall back
      // to price × size (stricter, but won't let through invalid orders).
      const notional = params.markPx !== undefined
        ? numericSize * Math.min(params.markPx, 1 - params.markPx)
        : numericPrice * numericSize;
      if (notional < MIN_NOTIONAL) {
        return {
          success: false,
          error: `Notional $${notional.toFixed(2)} below minimum $${MIN_NOTIONAL}`,
        };
      }
    }

    const orderWire: HLOrderWire = {
      a: assetId,
      b: isBuy,
      p: price,
      s: amount,
      r: false,
      t: mapTif(params.type, params.timeInForce),
    };

    // Canonical key order: type, orders, grouping
    const action: HLOrderAction & { builder?: { b: string; f: number } } = {
      type: "order",
      orders: [orderWire],
      grouping: "na",
    };

    // Builder fee support
    if (params.builderFee && params.builderFee > 0 && params.builderAddress) {
      action.builder = {
        b: params.builderAddress.toLowerCase(),
        f: params.builderFee,
      };
    }

    // Sort action keys into canonical order for signing
    const sortedAction = sortOrderAction(action);

    this.client.log("debug", "Order wire", orderWire);

    try {
      const nonce = Date.now();
      const signature = await signL1Action({
        signer,
        action: sortedAction,
        nonce,
        isTestnet: this.client.testnet,
      });

      const res = await this.client.placeOrder(
        sortedAction,
        nonce,
        signature,
        null,
      );

      if (res.status !== "ok" || !res.response) {
        return { success: false, error: "Exchange returned non-ok status" };
      }

      const firstStatus = res.response.data.statuses[0];
      if (!firstStatus) {
        return { success: false, error: "No order status returned" };
      }

      const result = interpretStatus(firstStatus);
      return {
        success: !result.error,
        ...result,
      };
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown order error";
      return { success: false, error: message };
    }
  }

  async cancelOrder(params: PredictionCancelParams): Promise<void> {
    const signer = this.auth.getSigner();
    if (!signer) {
      throw new Error("Not authenticated. Call auth.initAuth() first.");
    }

    // If outcome is provided, resolve the correct side asset ID; otherwise fall back to side 0
    const assetId = params.outcome
      ? resolveAssetId(params.marketId, params.outcome)
      : sideAssetId(parseInt(params.marketId, 10), 0); // fallback: side 0 (caller should provide outcome)
    const oid = parseInt(params.orderId, 10);

    const action: HLCancelAction = {
      type: "cancel",
      cancels: [{ a: assetId, o: oid }],
    };

    // Sort action keys into canonical order for signing
    const sortedAction = sortCancelAction(action);

    const nonce = Date.now();
    const signature = await signL1Action({
      signer,
      action: sortedAction,
      nonce,
      isTestnet: this.client.testnet,
    });

    await this.client.cancelOrder(sortedAction, nonce, signature, null);
  }
}
