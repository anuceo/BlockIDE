import { create } from 'zustand';
import { MultiChainService, type ChainConfig, type WalletConnection, type WalletType } from '../services/blockchain/MultiChainService';

interface BlockchainState {
  connections: WalletConnection[];
  currentChain: string;
  networks: ChainConfig[];
  transactions: unknown[];
  multiChainService: MultiChainService;

  connectWallet: (chainId: string, walletType?: WalletType) => Promise<void>;
  disconnectWallet: (chainId: string) => void;
  switchChain: (chainId: string) => void;
  addNetwork: (chain: ChainConfig) => void;
}

export const useBlockchainStore = create<BlockchainState>((set, get) => ({
  connections: [],
  currentChain: 'ethereum',
  networks: [],
  transactions: [],
  multiChainService: new MultiChainService(),

  connectWallet: async (chainId, walletType = 'metamask') => {
    const { multiChainService } = get();
    const connection = await multiChainService.connectWallet(chainId, walletType);
    set((state) => ({
      connections: [...state.connections.filter((c) => c.chain.id !== chainId), connection],
      currentChain: chainId,
    }));
  },

  disconnectWallet: (chainId) => {
    get().multiChainService.disconnectWallet(chainId);
    set((state) => ({ connections: state.connections.filter((c) => c.chain.id !== chainId) }));
  },

  switchChain: (chainId) => set({ currentChain: chainId }),

  addNetwork: (chain) => {
    get().multiChainService.addChain(chain);
    set((state) => ({ networks: [...state.networks, chain] }));
  },
}));

