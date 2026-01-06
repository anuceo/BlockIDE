import { create } from 'zustand';
import { MultiChainService } from '../services/blockchain/MultiChainService';
import type { ChainConfig, NodeInfo, WalletConnection } from '../types/blockchain';

interface BlockchainState {
  connections: WalletConnection[];
  currentChain: string;
  networks: ChainConfig[];
  activeNodes: NodeInfo[];
  transactions: any[];
  multiChainService: MultiChainService;

  connectWallet: (chainId: string, walletType?: string) => Promise<WalletConnection>;
  disconnectWallet: (chainId: string) => void;
  switchChain: (chainId: string) => Promise<void>;
  addNetwork: (chain: ChainConfig) => void;

  startNode: (type: 'ganache' | 'hardhat' | 'solana', port: number, options?: any) => Promise<NodeInfo>;
  stopNode: (pid: number) => Promise<void>;
  getNodeStatus: (pid: number) => Promise<NodeInfo>;
}

export const useBlockchainStore = create<BlockchainState>((set, get) => ({
  connections: [],
  currentChain: 'ethereum',
  networks: [],
  activeNodes: [],
  transactions: [],
  multiChainService: new MultiChainService(),

  connectWallet: async (chainId, walletType = 'metamask') => {
    const { multiChainService } = get();
    const connection = await multiChainService.connectWallet(chainId, walletType as any);
    set((state) => ({
      connections: [...state.connections.filter((c) => c.chain.id !== chainId), connection],
      currentChain: chainId,
    }));
    return connection;
  },

  disconnectWallet: (chainId) => {
    const { multiChainService } = get();
    multiChainService.disconnectWallet(chainId);
    set((state) => ({
      connections: state.connections.filter((c) => c.chain.id !== chainId),
    }));
  },

  switchChain: async (chainId) => {
    set({ currentChain: chainId });
  },

  addNetwork: (chain) => {
    set((state) => ({ networks: [...state.networks, chain] }));
  },

  startNode: async (type, port, options) => {
    const { multiChainService } = get();
    const nodeInfo = await multiChainService.startNode(type, port, options);
    set((state) => ({ activeNodes: [...state.activeNodes, nodeInfo] }));
    return nodeInfo;
  },

  stopNode: async (pid) => {
    const { multiChainService } = get();
    await multiChainService.stopNode(pid);
    set((state) => ({ activeNodes: state.activeNodes.filter((n) => n.pid !== pid) }));
  },

  getNodeStatus: async (pid) => {
    const { multiChainService } = get();
    return await multiChainService.getNodeStatus(pid);
  },
}));

