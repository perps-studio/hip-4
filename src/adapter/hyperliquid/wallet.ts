// ---------------------------------------------------------------------------
// HIP-4 Wallet Operations
//
// Fund management: transfers between spot/perp, withdrawals, USD sends,
// and USDH spot buy/sell.
//
// Signing:
//   - Transfers, withdrawals, sends: EIP-712 user signing (wallet signer)
//   - USDH buy/sell: L1 agent signing (agent key via auth)
//
// Reference: @nktkas/hyperliquid — withdraw3, usdClassTransfer, usdSend
// ---------------------------------------------------------------------------

import type { PredictionWalletAdapter, WalletActionResult } from "../types";
import type { HIP4Auth } from "./auth";
import type { HIP4Client } from "./client";
import type { HIP4Signer, HLOrderAction } from "./types";
import {
  signL1Action,
  signUserSignedAction,
  sortOrderAction,
  USD_CLASS_TRANSFER_TYPES,
  USD_SEND_TYPES,
  WITHDRAW_TYPES,
} from "./signing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UsdClassTransferParams {
  /** Amount to transfer (string, 1 = $1) */
  amount: string;
  /** true = spot → perp, false = perp → spot */
  toPerp: boolean;
}

/** USDH spot market index on Hyperliquid (from spotMeta universe) */
export const USDH_SPOT_INDEX = 1338;
/** USDH asset ID for order placement (10000 + spotMeta universe index) */
export const USDH_ASSET_ID = 10000 + USDH_SPOT_INDEX;
/** USDH spot pair name (for info endpoints / subscriptions) */
export const USDH_SPOT_PAIR = "@1338";

export interface WithdrawParams {
  /** Destination wallet address */
  destination: string;
  /** Amount to withdraw (string, 1 = $1) */
  amount: string;
}

export interface UsdSendParams {
  /** Destination wallet address */
  destination: string;
  /** Amount to send (string, 1 = $1) */
  amount: string;
}

export type { WalletActionResult } from "../types";

// ---------------------------------------------------------------------------
// HIP4WalletAdapter
// ---------------------------------------------------------------------------

export class HIP4WalletAdapter implements PredictionWalletAdapter {
  private signer: HIP4Signer | null = null;

  constructor(
    private readonly client: HIP4Client,
    private readonly auth: HIP4Auth,
  ) {}

  /**
   * Set the signer for wallet operations.
   *
   * IMPORTANT: This must be the user's actual wallet, NOT an agent key.
   * User-signed actions (withdraw, transfer, send) are validated against
   * the user's address on the exchange — an agent key will be rejected.
   *
   * Accepts a viem WalletClient-like object ({ address, signTypedData })
   * or a native HIP4Signer. Viem-style signers are auto-wrapped.
   */
  setSigner(signer: HIP4Signer | { address: string; signTypedData: (...args: unknown[]) => Promise<string> }): void {
    const obj = signer as Record<string, unknown>;

    // Native HIP4Signer: has getAddress() function
    if (typeof obj.getAddress === "function" && typeof obj.signTypedData === "function") {
      this.signer = signer as HIP4Signer;
      return;
    }

    // Viem-style: has .address (string) + .signTypedData (function)
    if (typeof obj.address === "string" && typeof obj.signTypedData === "function") {
      const addr = obj.address as string;
      const sign = obj.signTypedData as (...args: unknown[]) => Promise<string>;
      this.signer = {
        getAddress: () => addr,
        signTypedData: (domain, types, value) => {
          const primaryType = Object.keys(types)[0];
          if (!primaryType) throw new Error("EIP-712 types object is empty");
          return sign({
            domain,
            types: { ...types },
            primaryType,
            message: value,
          });
        },
      };
      return;
    }

    throw new Error("Invalid signer: must have getAddress()+signTypedData() or address+signTypedData()");
  }

  /**
   * Buy USDH on the spot market. Uses L1 agent signing (requires auth).
   * Amount is in USDH units.
   */
  async buyUsdh(amount: string): Promise<WalletActionResult> {
    return this.executeSpotOrder(true, amount);
  }

  /**
   * Sell USDH on the spot market. Uses L1 agent signing (requires auth).
   * Amount is in USDH units.
   */
  async sellUsdh(amount: string): Promise<WalletActionResult> {
    return this.executeSpotOrder(false, amount);
  }

  /**
   * Transfer USDC from Perp account to Spot account.
   * This is step 1 of the deposit flow (after bridging USDC to HL).
   */
  async transferToSpot(amount: string): Promise<WalletActionResult> {
    return this.usdClassTransfer({ amount, toPerp: false });
  }

  /**
   * Transfer USDC from Spot account to Perp account.
   * This is step 2 of the withdraw flow (before withdraw3).
   */
  async transferToPerps(amount: string): Promise<WalletActionResult> {
    return this.usdClassTransfer({ amount, toPerp: true });
  }

  /**
   * Transfer funds between Spot and Perp accounts.
   *
   * HIP-4 prediction markets use the Spot account. To fund trading:
   *   - `toPerp: false` moves USDC from Perp → Spot (deposit into predictions)
   *   - `toPerp: true` moves USDC from Spot → Perp (withdraw from predictions)
   */
  async usdClassTransfer(params: UsdClassTransferParams): Promise<WalletActionResult> {
    return this.executeUserSigned(
      "usdClassTransfer",
      { amount: params.amount, toPerp: params.toPerp },
      USD_CLASS_TRANSFER_TYPES,
      "nonce",
    );
  }

  /**
   * Initiate a withdrawal to an external address.
   */
  async withdraw(params: WithdrawParams): Promise<WalletActionResult> {
    return this.executeUserSigned(
      "withdraw3",
      { destination: params.destination, amount: params.amount },
      WITHDRAW_TYPES,
      "time",
    );
  }

  /**
   * Send USDC to another Hyperliquid address.
   */
  async usdSend(params: UsdSendParams): Promise<WalletActionResult> {
    return this.executeUserSigned(
      "usdSend",
      { destination: params.destination, amount: params.amount },
      USD_SEND_TYPES,
      "time",
    );
  }

  // -------------------------------------------------------------------------
  // Internal
  // -------------------------------------------------------------------------

  /** Place a spot market order for USDH using L1 agent signing. */
  private async executeSpotOrder(isBuy: boolean, amount: string): Promise<WalletActionResult> {
    const agentSigner = this.auth.getSigner();
    if (!agentSigner) {
      return { success: false, error: "Not authenticated. Call auth.initAuth() first." };
    }

    try {
      // Fetch oracle/mark price — HL validates orders against this, not mid
      const ctx = await this.client.fetchSpotAssetCtx(USDH_SPOT_INDEX);
      const oracle = ctx ? parseFloat(ctx.markPx) : 0;
      if (oracle <= 0) {
        return { success: false, error: "Could not fetch USDH oracle price" };
      }
      // 10% from oracle — safely within HL's limit while ensuring fill
      const price = isBuy
        ? (oracle * 1.1).toFixed(5)
        : (oracle * 0.9).toFixed(5);

      const action: HLOrderAction = {
        type: "order",
        orders: [{
          a: USDH_ASSET_ID,
          b: isBuy,
          p: price,
          s: amount,
          r: false,
          t: { limit: { tif: "Ioc" } },
        }],
        grouping: "na",
      };

      const sortedAction = sortOrderAction(action);
      const nonce = Date.now();
      const signature = await signL1Action({
        signer: agentSigner,
        action: sortedAction,
        nonce,
        isTestnet: this.client.testnet,
      });

      const res = await this.client.placeOrder(sortedAction, nonce, signature, null);
      if (res.status !== "ok" || !res.response) {
        return { success: false, error: "Exchange returned non-ok status" };
      }

      const firstStatus = res.response.data.statuses[0];
      if (!firstStatus) {
        return { success: false, error: "No order status returned" };
      }
      if ("error" in firstStatus) {
        return { success: false, error: firstStatus.error };
      }

      const filled = "filled" in firstStatus ? (firstStatus as { filled: { totalSz: string; avgPx: string } }).filled : undefined;
      return {
        success: true,
        filledSz: filled?.totalSz,
        avgPx: filled?.avgPx,
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: message };
    }
  }

  private async executeUserSigned(
    type: string,
    fields: Record<string, unknown>,
    types: Record<string, Array<{ name: string; type: string }>>,
    nonceFieldName: "nonce" | "time",
  ): Promise<WalletActionResult> {
    if (!this.signer) {
      return { success: false, error: "No wallet signer set. Call wallet.setSigner() first." };
    }

    try {
      const nonce = Date.now();

      const action: Record<string, unknown> & { signatureChainId: string } = {
        type,
        signatureChainId: "0x66eee",
        hyperliquidChain: this.client.testnet ? "Testnet" : "Mainnet",
        ...fields,
        [nonceFieldName]: nonce,
      };

      const signature = await signUserSignedAction({
        signer: this.signer,
        action,
        types,
      });

      const res = await this.client.submitUserSignedAction(action, nonce, signature);

      if (res.status === "ok") {
        return { success: true };
      }

      let errorMsg = "Action failed";
      if (typeof res.response === "string") {
        errorMsg = res.response;
      } else if (res.response && typeof res.response === "object" && !Array.isArray(res.response)) {
        const obj = res.response as Record<string, unknown>;
        if (typeof obj.error === "string") errorMsg = obj.error;
      }
      return { success: false, error: errorMsg };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      return { success: false, error: message };
    }
  }
}
