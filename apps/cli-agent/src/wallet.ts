/**
 * Wallet Module
 *
 * In-memory wallet management for CLI Agent.
 * IMPORTANT: Private keys are NEVER stored to disk.
 * User must provide private key each session.
 */

import { ethers, TypedDataDomain, TypedDataField } from "ethers";

export class InMemoryWallet {
  private wallet: ethers.Wallet | ethers.HDNodeWallet | null = null;

  /**
   * Set wallet from private key (in-memory only)
   */
  setPrivateKey(privateKey: string): { success: boolean; address?: string; error?: string } {
    try {
      // Normalize key format
      const key = privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`;
      this.wallet = new ethers.Wallet(key);
      return { success: true, address: this.wallet.address };
    } catch (err) {
      this.wallet = null;
      return {
        success: false,
        error: err instanceof Error ? err.message : "Invalid private key",
      };
    }
  }

  /**
   * Generate a new random wallet (for demo)
   */
  generateRandom(): { address: string; privateKey: string } {
    const hdWallet = ethers.Wallet.createRandom();
    this.wallet = hdWallet;
    return {
      address: hdWallet.address,
      privateKey: hdWallet.privateKey,
    };
  }

  /**
   * Check if wallet is configured
   */
  isConfigured(): boolean {
    return this.wallet !== null;
  }

  /**
   * Get wallet address
   */
  getAddress(): string | null {
    return this.wallet?.address ?? null;
  }

  /**
   * Sign EIP-712 typed data (for deal settlement)
   */
  async signTypedData(
    domain: TypedDataDomain,
    types: Record<string, TypedDataField[]>,
    message: Record<string, unknown>
  ): Promise<string> {
    if (!this.wallet) {
      throw new Error("Wallet not configured. Use /secret-key to set your private key.");
    }
    return this.wallet.signTypedData(domain, types, message);
  }

  /**
   * Sign a message
   */
  async signMessage(message: string): Promise<string> {
    if (!this.wallet) {
      throw new Error("Wallet not configured. Use /secret-key to set your private key.");
    }
    return this.wallet.signMessage(message);
  }

  /**
   * Get a connected wallet (for blockchain queries)
   */
  connect(provider: ethers.Provider): ethers.Wallet | ethers.HDNodeWallet {
    if (!this.wallet) {
      throw new Error("Wallet not configured");
    }
    return this.wallet.connect(provider);
  }

  /**
   * Clear wallet (for security)
   */
  clear(): void {
    this.wallet = null;
  }
}

/**
 * Query USDC balance on a chain
 */
export async function getUSDCBalance(
  address: string,
  rpcUrl: string,
  usdcAddress: string
): Promise<string> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const abi = ["function balanceOf(address) view returns (uint256)"];
  const contract = new ethers.Contract(usdcAddress, abi, provider);

  try {
    const balance = await contract.balanceOf(address);
    return ethers.formatUnits(balance, 6); // USDC has 6 decimals
  } catch (err) {
    throw new Error(`Failed to query balance: ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Query native token balance
 */
export async function getNativeBalance(address: string, rpcUrl: string): Promise<string> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  try {
    const balance = await provider.getBalance(address);
    return ethers.formatEther(balance);
  } catch (err) {
    throw new Error(`Failed to query balance: ${err instanceof Error ? err.message : err}`);
  }
}
