import { invoke } from '@tauri-apps/api/core';
import type {
  ChainConfig,
  NodeInfo,
  NodeOptions,
  WalletConnection,
} from '../../types/blockchain';

export class MultiChainService {
  private connections: Map<string, WalletConnection> = new Map();
  private chains: Map<string, ChainConfig> = new Map();

  private defaultChains: ChainConfig[] = [
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
      rpcUrls: ['https://sepolia.infura.io/v3/'],
      nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
      blockExplorerUrls: ['https://sepolia.etherscan.io'],
      testnet: true,
    },
    {
      id: 'polygon',
      name: 'Polygon',
      chainId: 137,
      rpcUrls: ['https://polygon-rpc.com'],
      nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
      blockExplorerUrls: ['https://polygonscan.com'],
      testnet: false,
    },
    {
      id: 'bsc',
      name: 'BNB Smart Chain',
      chainId: 56,
      rpcUrls: ['https://bsc-dataseed.binance.org'],
      nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
      blockExplorerUrls: ['https://bscscan.com'],
      testnet: false,
    },
    {
      id: 'solana',
      name: 'Solana',
      chainId: 101,
      rpcUrls: ['https://api.mainnet-beta.solana.com'],
      nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
      blockExplorerUrls: ['https://explorer.solana.com'],
      testnet: false,
    },
    {
      id: 'solana-devnet',
      name: 'Solana Devnet',
      chainId: 103,
      rpcUrls: ['https://api.devnet.solana.com'],
      nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
      blockExplorerUrls: ['https://explorer.solana.com/?cluster=devnet'],
      testnet: true,
    },
  ];

  constructor() {
    this.defaultChains.forEach((chain) => {
      this.chains.set(chain.id, chain);
    });
  }

  async connectWallet(
    chainId: string,
    walletType: 'metamask' | 'phantom' | 'walletconnect' = 'metamask'
  ): Promise<WalletConnection> {
    const chain = this.chains.get(chainId);
    if (!chain) {
      throw new Error(`Chain ${chainId} not supported`);
    }

    let connection: WalletConnection;

    if (chainId.startsWith('ethereum') || chainId === 'polygon' || chainId === 'bsc') {
      connection = await this.connectEVMWallet(chain, walletType);
    } else if (chainId.startsWith('solana')) {
      connection = await this.connectSolanaWallet(chain, walletType);
    } else {
      throw new Error(`Unsupported chain: ${chainId}`);
    }

    this.connections.set(chainId, connection);
    return connection;
  }

  private async connectEVMWallet(chain: ChainConfig, _walletType: string): Promise<WalletConnection> {
    const ethereum = (window as any).ethereum;
    if (!ethereum) {
      throw new Error('Ethereum wallet not found. Please install MetaMask.');
    }

    const accounts = await ethereum.request({
      method: 'eth_requestAccounts',
    });

    const address = accounts[0];

    return {
      address,
      chainId: chain.chainId,
      provider: ethereum,
      chain,
      connected: true,
    };
  }

  private async connectSolanaWallet(chain: ChainConfig, _walletType: string): Promise<WalletConnection> {
    const { solana } = window as any;

    if (!solana?.isPhantom) {
      throw new Error('Phantom wallet not found. Please install Phantom.');
    }

    const response = await solana.connect();
    const publicKey = response.publicKey.toString();

    return {
      address: publicKey,
      chainId: chain.chainId,
      provider: solana,
      chain,
      connected: true,
    };
  }

  async startNode(type: 'ganache' | 'hardhat' | 'solana', port: number, options: NodeOptions = {}): Promise<NodeInfo> {
    return await invoke<NodeInfo>('start_node', {
      nodeType: type,
      port,
      options,
    });
  }

  async stopNode(pid: number): Promise<void> {
    await invoke('stop_node', { pid });
  }

  async getNodeStatus(pid: number): Promise<NodeInfo> {
    return await invoke<NodeInfo>('get_node_status', { pid });
  }

  disconnectWallet(chainId: string): void {
    this.connections.delete(chainId);
  }

  getChain(chainId: string): ChainConfig | undefined {
    return this.chains.get(chainId);
  }

  getAllChains(): ChainConfig[] {
    return Array.from(this.chains.values());
  }

  getConnection(chainId: string): WalletConnection | undefined {
    return this.connections.get(chainId);
  }
}

