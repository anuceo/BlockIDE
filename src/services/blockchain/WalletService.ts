export interface ChainConfig {
  id: string
  name: string
  chainId: number
  rpcUrls: string[]
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  blockExplorerUrls?: string[]
  testnet: boolean
}

export interface WalletConnection {
  address: string
  chainId: number
  provider: any
  chain: ChainConfig
  connected: boolean
}

type Listener = (data: any) => void

export class WalletService {
  private static connections: Map<string, WalletConnection> = new Map()
  private static listeners: Map<string, Listener[]> = new Map()

  static async connectEthereum(chainKey: string = 'ethereum'): Promise<WalletConnection> {
    const ethereum = window.ethereum
    if (!ethereum) {
      throw new Error('No Ethereum wallet found. Please install MetaMask.')
    }

    const accounts: string[] = await ethereum.request({ method: 'eth_requestAccounts' })
    if (!accounts || accounts.length === 0) {
      throw new Error('No accounts found. Please unlock your wallet.')
    }

    const address = accounts[0]
    const chainConfig = this.getChainConfig(chainKey)

    const currentChainId: string = await ethereum.request({ method: 'eth_chainId' })
    const targetChainIdHex = `0x${chainConfig.chainId.toString(16)}`
    if (currentChainId !== targetChainIdHex) {
      try {
        await ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: targetChainIdHex }],
        })
      } catch (switchError: any) {
        if (switchError?.code === 4902) {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [
              {
                chainId: targetChainIdHex,
                chainName: chainConfig.name,
                nativeCurrency: chainConfig.nativeCurrency,
                rpcUrls: chainConfig.rpcUrls,
                blockExplorerUrls: chainConfig.blockExplorerUrls,
              },
            ],
          })
        } else {
          throw switchError
        }
      }
    }

    const connection: WalletConnection = {
      address,
      chainId: chainConfig.chainId,
      provider: ethereum,
      chain: chainConfig,
      connected: true,
    }

    this.connections.set(chainKey, connection)
    this.setupEventListeners(ethereum, chainKey)
    this.notifyListeners('walletConnected', connection)

    return connection
  }

  static async connectSolana(): Promise<WalletConnection> {
    const solana = window.solana
    if (!solana?.isPhantom) {
      throw new Error('No Phantom wallet found. Please install Phantom.')
    }

    const response = await solana.connect()
    const address = response.publicKey.toString()

    const chainConfig: ChainConfig = {
      id: 'solana',
      name: 'Solana',
      chainId: 101,
      rpcUrls: ['https://api.mainnet-beta.solana.com'],
      nativeCurrency: { name: 'Solana', symbol: 'SOL', decimals: 9 },
      blockExplorerUrls: ['https://explorer.solana.com'],
      testnet: false,
    }

    const connection: WalletConnection = {
      address,
      chainId: chainConfig.chainId,
      provider: solana,
      chain: chainConfig,
      connected: true,
    }

    this.connections.set('solana', connection)
    this.notifyListeners('walletConnected', connection)
    return connection
  }

  static async disconnect(chainKey: string): Promise<void> {
    const connection = this.connections.get(chainKey)
    if (!connection) return

    if (chainKey === 'solana') {
      const solana = window.solana
      if (solana?.disconnect) {
        await solana.disconnect()
      }
    }

    this.connections.delete(chainKey)
    this.notifyListeners('walletDisconnected', { chainKey })
  }

  static async signMessage(chainKey: string, message: string): Promise<string> {
    const connection = this.connections.get(chainKey)
    if (!connection) throw new Error('Wallet not connected')

    if (chainKey === 'solana') {
      throw new Error('Solana signing not implemented yet')
    }

    const ethereum = window.ethereum
    if (!ethereum) throw new Error('No Ethereum provider found')

    return ethereum.request({
      method: 'personal_sign',
      params: [message, connection.address],
    })
  }

  static async sendTransaction(chainKey: string, transaction: any): Promise<string> {
    const connection = this.connections.get(chainKey)
    if (!connection) throw new Error('Wallet not connected')

    if (chainKey === 'solana') {
      throw new Error('Unsupported chain for transaction sending')
    }

    const ethereum = window.ethereum
    if (!ethereum) throw new Error('No Ethereum provider found')

    return ethereum.request({
      method: 'eth_sendTransaction',
      params: [transaction],
    })
  }

  static addListener(event: string, callback: Listener): void {
    if (!this.listeners.has(event)) this.listeners.set(event, [])
    this.listeners.get(event)!.push(callback)
  }

  static removeListener(event: string, callback: Listener): void {
    const callbacks = this.listeners.get(event)
    if (!callbacks) return
    const idx = callbacks.indexOf(callback)
    if (idx >= 0) callbacks.splice(idx, 1)
  }

  static getConnection(chainKey: string): WalletConnection | undefined {
    return this.connections.get(chainKey)
  }

  private static notifyListeners(event: string, data: any): void {
    const callbacks = this.listeners.get(event)
    if (!callbacks) return
    for (const cb of callbacks) {
      try {
        cb(data)
      } catch (e) {
        console.error(`Error in ${event} listener:`, e)
      }
    }
  }

  private static setupEventListeners(ethereum: NonNullable<Window['ethereum']>, chainKey: string) {
    ethereum.on('accountsChanged', (accounts: string[]) => {
      if (accounts.length === 0) {
        void this.disconnect(chainKey)
      } else {
        const connection = this.connections.get(chainKey)
        if (connection) {
          connection.address = accounts[0]
          this.notifyListeners('accountsChanged', { chainKey, address: accounts[0] })
        }
      }
    })

    ethereum.on('chainChanged', (newChainId: string) => {
      this.notifyListeners('chainChanged', { chainKey, newChainId })
    })

    ethereum.on('disconnect', (error: any) => {
      void this.disconnect(chainKey)
      this.notifyListeners('walletDisconnected', { chainKey, error })
    })
  }

  private static getChainConfig(chainKey: string): ChainConfig {
    const chains: Record<string, ChainConfig> = {
      ethereum: {
        id: 'ethereum',
        name: 'Ethereum',
        chainId: 1,
        rpcUrls: ['https://eth.llamarpc.com'],
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        blockExplorerUrls: ['https://etherscan.io'],
        testnet: false,
      },
      polygon: {
        id: 'polygon',
        name: 'Polygon',
        chainId: 137,
        rpcUrls: ['https://polygon-rpc.com'],
        nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
        blockExplorerUrls: ['https://polygonscan.com'],
        testnet: false,
      },
      bsc: {
        id: 'bsc',
        name: 'BNB Smart Chain',
        chainId: 56,
        rpcUrls: ['https://bsc-dataseed.binance.org'],
        nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
        blockExplorerUrls: ['https://bscscan.com'],
        testnet: false,
      },
      'ethereum-sepolia': {
        id: 'ethereum-sepolia',
        name: 'Ethereum Sepolia',
        chainId: 11155111,
        rpcUrls: ['https://sepolia.infura.io/v3/'],
        nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
        blockExplorerUrls: ['https://sepolia.etherscan.io'],
        testnet: true,
      },
    }

    return chains[chainKey] ?? chains.ethereum
  }
}

