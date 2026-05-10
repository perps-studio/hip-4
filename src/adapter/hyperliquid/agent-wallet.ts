import { splitHexSignature, type HLSignature } from "./types";

const HL_EIP712_DOMAIN = {
  name: "HyperliquidSignTransaction",
  version: "1",
  chainId: 42161,
  verifyingContract: "0x0000000000000000000000000000000000000000" as `0x${string}`,
} as const;

const HL_MAINNET_API = "https://api.hyperliquid.xyz";
const HL_TESTNET_API = "https://api.hyperliquid-testnet.xyz";

/** Build EIP-712 typed data for an agent-wallet approval signature. */
export function getAgentApprovalTypedData(
  agentAddress: `0x${string}`,
  agentName: string,
  nonce: number,
  isMainnet = true,
) {
  return {
    domain: HL_EIP712_DOMAIN,
    types: {
      "HyperliquidTransaction:ApproveAgent": [
        { name: "hyperliquidChain", type: "string" },
        { name: "agentAddress", type: "address" },
        { name: "agentName", type: "string" },
        { name: "nonce", type: "uint64" },
      ],
    },
    primaryType: "HyperliquidTransaction:ApproveAgent" as const,
    message: {
      hyperliquidChain: isMainnet ? "Mainnet" : "Testnet",
      agentAddress: agentAddress.toLowerCase() as `0x${string}`,
      agentName,
      nonce: BigInt(nonce),
    },
  };
}

/** Submit a signed agent-approval transaction to the Hyperliquid exchange API. */
export async function submitAgentApproval(
  signature: `0x${string}`,
  agentAddress: `0x${string}`,
  agentName: string,
  nonce: number,
  isMainnet = true,
  exchangeUrl?: string,
): Promise<{ success: boolean; error?: string }> {
  const parsedSig: HLSignature = splitHexSignature(signature);

  const action = {
    type: "approveAgent",
    signatureChainId: "0xa4b1",
    hyperliquidChain: isMainnet ? "Mainnet" : "Testnet",
    agentAddress: agentAddress.toLowerCase(),
    agentName,
    nonce,
  };

  try {
    const url = exchangeUrl ?? `${isMainnet ? HL_MAINNET_API : HL_TESTNET_API}/exchange`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        nonce,
        signature: parsedSig,
      }),
    });

    const result = (await response.json()) as {
      status?: string;
      response?: { error?: string };
    };

    if (result.status === "ok") {
      return { success: true };
    }

    return {
      success: false,
      error: result.response?.error ?? "Failed to approve agent",
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
