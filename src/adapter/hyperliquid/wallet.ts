// ---------------------------------------------------------------------------
// HIP-4 Wallet Operations
//
// User-signed actions for fund management: transfers between spot/perp,
// withdrawals, and USD sends. These use EIP-712 signing on the
// HyperliquidSignTransaction domain, NOT L1 agent signing.
//
// Reference: @nktkas/hyperliquid — withdraw3, usdClassTransfer, usdSend
// ---------------------------------------------------------------------------

import type { HIP4Client } from "./client";
import type { HIP4Signer } from "./types";
import {
  signUserSignedAction,
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

export interface WalletActionResult {
  success: boolean;
  error?: string;
}

// ---------------------------------------------------------------------------
// HIP4WalletAdapter
// ---------------------------------------------------------------------------

export class HIP4WalletAdapter {
  private signer: HIP4Signer | null = null;

  constructor(
    private readonly client: HIP4Client,
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
