import { ethers } from 'ethers';

export interface ChainConfig {
  id: string;
  name: string;
  chainId: number;
  rpcUrls: string[];
  nativeCurrency: { name: string; symbol: string; decimals: number };
  blockExplorerUrls?: string[];
  testnet: boolean;
}

export interface WalletConnection {
  address: string;
  chainId: number;
  provider: ethers.BrowserProvider;
  signer: ethers.Signer;
  chain: ChainConfig;
  connected: boolean;
}

export type WalletType = 'metamask';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

export class MultiChainService {
  private chains = new Map<string, ChainConfig>();
  private connections = new Map<string, WalletConnection>();

  constructor() {
    const defaults: ChainConfig[] = [
      {
        id: 'ethereum',
        name: 'Ethereum',
        chainId: 1,
        rpcUrls: ['https://eth.llamarpc.com'],
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        blockExplorerUrls: ['https://etherscan.io'],
        testnet: false,
      },
      {
        id: 'ethereum-sepolia',
        name: 'Ethereum Sepolia',
        chainId: 11155111,
        rpcUrls: ['https://rpc.sepolia.org'],
        nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
        blockExplorerUrls: ['https://sepolia.etherscan.io'],
        testnet: true,
      },
    ];
    for (const c of defaults) this.chains.set(c.id, c);
  }

  addChain(chain: ChainConfig) {
    this.chains.set(chain.id, chain);
  }

  getAllChains(): ChainConfig[] {
    return Array.from(this.chains.values());
  }

  getConnection(chainId: string): WalletConnection | undefined {
    return this.connections.get(chainId);
  }

  disconnectWallet(chainId: string) {
    this.connections.delete(chainId);
  }

  async connectWallet(chainId: string, walletType: WalletType = 'metamask'): Promise<WalletConnection> {
    const chain = this.chains.get(chainId);
    if (!chain) throw new Error(`Chain ${chainId} not supported`);
    if (walletType !== 'metamask') throw new Error(`Wallet type ${walletType} not supported in MVP`);
    if (!window.ethereum) throw new Error('Ethereum wallet not found');

    const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
    const address = accounts[0];

    // Best-effort chain switch; if rejected, we still proceed with whatever network user is on.
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${chain.chainId.toString(16)}` }],
      });
    } catch {
      // ignore for MVP
    }

    const provider = new ethers.BrowserProvider(window.ethereum as any);
    const signer = await provider.getSigner();
    const net = await provider.getNetwork();

    const connection: WalletConnection = {
      address,
      chainId: Number(net.chainId),
      provider,
      signer,
      chain,
      connected: true,
    };

    this.connections.set(chainId, connection);
    return connection;
  }
}

