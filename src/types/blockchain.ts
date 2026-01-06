export interface ChainConfig {
  id: string;
  name: string;
  chainId: number;
  rpcUrls: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  blockExplorerUrls?: string[];
  iconUrl?: string;
  testnet: boolean;
}

export interface WalletConnection {
  address: string;
  chainId: number;
  provider: any;
  signer?: any;
  chain: ChainConfig;
  connected: boolean;
}

export interface TransactionRequest {
  to: string;
  value?: string;
  data?: string;
  gasLimit?: string;
  gasPrice?: string;
  nonce?: number;
}

export interface TransactionResult {
  hash: string;
  from: string;
  to?: string;
  value: string;
  gasUsed: string;
  status: 'success' | 'failed' | 'pending';
  blockNumber?: number;
  timestamp?: number;
  receipt?: any;
  error?: string;
}

export interface NodeInfo {
  pid: number;
  node_type: string;
  port: number;
  status: string;
  rpc_url: string;
  start_time: number;
}

export interface NodeOptions {
  chainId?: number;
  accounts?: number;
  mnemonic?: string;
  fork?: string;
  blockTime?: number;
}

