import { describe, it, expect, vi } from "vitest";
import { HIP4WalletAdapter } from "../../src/adapter/hyperliquid/wallet";
import type { HIP4Client } from "../../src/adapter/hyperliquid/client";
import type { HIP4Signer } from "../../src/adapter/hyperliquid/types";

// ---------------------------------------------------------------------------
// Mock client
// ---------------------------------------------------------------------------

function mockClient(testnet = true): HIP4Client {
  return {
    testnet,
    submitUserSignedAction: vi.fn().mockResolvedValue({ status: "ok" }),
  } as unknown as HIP4Client;
}

// ---------------------------------------------------------------------------
// Mock signers
// ---------------------------------------------------------------------------

function mockHIP4Signer(): HIP4Signer {
  return {
    getAddress: () => "0xabc",
    signTypedData: vi.fn().mockResolvedValue({
      r: "0x" + "aa".repeat(32),
      s: "0x" + "bb".repeat(32),
      v: 27,
    }),
  };
}

function mockViemSigner() {
  return {
    address: "0xdef",
    signTypedData: vi.fn().mockResolvedValue("0x" + "cc".repeat(65)),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HIP4WalletAdapter", () => {
  describe("setSigner", () => {
    it("accepts a native HIP4Signer (has getAddress)", () => {
      const client = mockClient();
      const wallet = new HIP4WalletAdapter(client);
      const signer = mockHIP4Signer();
      expect(() => wallet.setSigner(signer)).not.toThrow();
    });

    it("accepts a viem-style signer (has .address string)", () => {
      const client = mockClient();
      const wallet = new HIP4WalletAdapter(client);
      const signer = mockViemSigner();
      expect(() => wallet.setSigner(signer)).not.toThrow();
    });

    it("wraps viem signer to call signTypedData with object arg", async () => {
      const client = mockClient();
      const wallet = new HIP4WalletAdapter(client);
      const signer = mockViemSigner();
      wallet.setSigner(signer);

      await wallet.usdClassTransfer({ amount: "10", toPerp: false });

      expect(signer.signTypedData).toHaveBeenCalledOnce();
      const callArg = (signer.signTypedData as ReturnType<typeof vi.fn>).mock.calls[0][0];
      // Viem-style: single object with domain, types, primaryType, message
      expect(callArg).toHaveProperty("domain");
      expect(callArg).toHaveProperty("types");
      expect(callArg).toHaveProperty("primaryType");
      expect(callArg).toHaveProperty("message");
      expect(callArg.primaryType).toBe("HyperliquidTransaction:UsdClassTransfer");
    });

    it("throws on invalid signer (no address, no getAddress)", () => {
      const client = mockClient();
      const wallet = new HIP4WalletAdapter(client);
      expect(() => wallet.setSigner({ signTypedData: vi.fn() } as unknown as HIP4Signer)).toThrow("Invalid signer");
    });
  });

  describe("usdClassTransfer", () => {
    it("returns error when no signer set", async () => {
      const client = mockClient();
      const wallet = new HIP4WalletAdapter(client);
      const res = await wallet.usdClassTransfer({ amount: "10", toPerp: false });
      expect(res.success).toBe(false);
      expect(res.error).toContain("No wallet signer");
    });

    it("sends correct action for toPerp=false (deposit to spot)", async () => {
      const client = mockClient();
      const wallet = new HIP4WalletAdapter(client);
      wallet.setSigner(mockHIP4Signer());

      await wallet.usdClassTransfer({ amount: "100", toPerp: false });

      const call = (client.submitUserSignedAction as ReturnType<typeof vi.fn>).mock.calls[0];
      const action = call[0];
      expect(action.type).toBe("usdClassTransfer");
      expect(action.amount).toBe("100");
      expect(action.toPerp).toBe(false);
      expect(action.signatureChainId).toBe("0x66eee");
      expect(action.hyperliquidChain).toBe("Testnet");
    });

    it("uses Mainnet for non-testnet client", async () => {
      const client = mockClient(false);
      const wallet = new HIP4WalletAdapter(client);
      wallet.setSigner(mockHIP4Signer());

      await wallet.usdClassTransfer({ amount: "10", toPerp: true });

      const action = (client.submitUserSignedAction as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(action.hyperliquidChain).toBe("Mainnet");
    });

    it("returns success on ok response", async () => {
      const client = mockClient();
      const wallet = new HIP4WalletAdapter(client);
      wallet.setSigner(mockHIP4Signer());

      const res = await wallet.usdClassTransfer({ amount: "10", toPerp: false });
      expect(res.success).toBe(true);
      expect(res.error).toBeUndefined();
    });

    it("returns error on non-ok response", async () => {
      const client = mockClient();
      (client.submitUserSignedAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: "err",
        response: { error: "Insufficient balance" },
      });
      const wallet = new HIP4WalletAdapter(client);
      wallet.setSigner(mockHIP4Signer());

      const res = await wallet.usdClassTransfer({ amount: "10", toPerp: false });
      expect(res.success).toBe(false);
      expect(res.error).toBe("Insufficient balance");
    });
  });

  describe("withdraw", () => {
    it("sends withdraw3 action with destination and time field", async () => {
      const client = mockClient();
      const wallet = new HIP4WalletAdapter(client);
      wallet.setSigner(mockHIP4Signer());

      await wallet.withdraw({ destination: "0xdead", amount: "50" });

      const action = (client.submitUserSignedAction as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(action.type).toBe("withdraw3");
      expect(action.destination).toBe("0xdead");
      expect(action.amount).toBe("50");
      expect(action.time).toBeTypeOf("number");
      // withdraw3 uses "time" not "nonce"
      expect(action.nonce).toBeUndefined();
    });
  });

  describe("usdSend", () => {
    it("sends usdSend action with destination and time field", async () => {
      const client = mockClient();
      const wallet = new HIP4WalletAdapter(client);
      wallet.setSigner(mockHIP4Signer());

      await wallet.usdSend({ destination: "0xbeef", amount: "25" });

      const action = (client.submitUserSignedAction as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(action.type).toBe("usdSend");
      expect(action.destination).toBe("0xbeef");
      expect(action.amount).toBe("25");
      expect(action.time).toBeTypeOf("number");
    });
  });

  describe("error handling", () => {
    it("catches signer errors and returns them", async () => {
      const client = mockClient();
      const wallet = new HIP4WalletAdapter(client);
      const signer = mockHIP4Signer();
      (signer.signTypedData as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("User rejected"));
      wallet.setSigner(signer);

      const res = await wallet.usdClassTransfer({ amount: "10", toPerp: false });
      expect(res.success).toBe(false);
      expect(res.error).toBe("User rejected");
    });

    it("handles string error response", async () => {
      const client = mockClient();
      (client.submitUserSignedAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: "err",
        response: "Rate limited",
      });
      const wallet = new HIP4WalletAdapter(client);
      wallet.setSigner(mockHIP4Signer());

      const res = await wallet.withdraw({ destination: "0x1", amount: "1" });
      expect(res.success).toBe(false);
      expect(res.error).toBe("Rate limited");
    });

    it("handles missing error details gracefully", async () => {
      const client = mockClient();
      (client.submitUserSignedAction as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: "err",
      });
      const wallet = new HIP4WalletAdapter(client);
      wallet.setSigner(mockHIP4Signer());

      const res = await wallet.usdSend({ destination: "0x1", amount: "1" });
      expect(res.success).toBe(false);
      expect(res.error).toBe("Action failed");
    });
  });
});
