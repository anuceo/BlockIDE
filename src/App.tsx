import { invoke } from '@tauri-apps/api/core'
import { useEffect, useMemo, useState } from 'react'
import { NodeManager } from './components/NodeManager'
import { WalletService, type WalletConnection } from './services/blockchain/WalletService'
import { SolidityCompiler, type CompilationResult } from './services/compiler/SolidityCompiler'
import './App.css'

const CHAIN_ID_MAP: Record<string, number> = {
  ethereum: 1,
  polygon: 137,
  bsc: 56,
  'ethereum-sepolia': 11155111,
  local: 1337,
}

const DEFAULT_LOCAL_RPC = 'http://127.0.0.1:8545'
// Hardhat/Anvil default account #1 for the standard test mnemonic.
const DEFAULT_LOCAL_PRIVATE_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'

type Tab = 'editor' | 'nodes'

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('editor')

  const [code, setCode] = useState<string>(`// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract HelloWorld {
    string public greeting = "Hello, World!";
    
    function setGreeting(string memory _greeting) public {
        greeting = _greeting;
    }
    
    function getGreeting() public view returns (string memory) {
        return greeting;
    }
}`)

  const [compilationResult, setCompilationResult] = useState<CompilationResult | null>(null)
  const [isCompiling, setIsCompiling] = useState(false)

  const [walletAddress, setWalletAddress] = useState<string>('')
  const [isConnected, setIsConnected] = useState(false)
  const [activeChain, setActiveChain] = useState<string>('local')
  const [rpcUrl, setRpcUrl] = useState<string>(DEFAULT_LOCAL_RPC)
  const [privateKey, setPrivateKey] = useState<string>('')
  const [deploymentStatus, setDeploymentStatus] = useState<string>('')
  const [deployedAddress, setDeployedAddress] = useState<string>('')

  const walletConnectedCb = useMemo(
    () => (connection: WalletConnection) => {
      setWalletAddress(connection.address)
      setIsConnected(true)
      setActiveChain(connection.chain.id)
      setRpcUrl(connection.chain.rpcUrls?.[0] ?? 'https://eth.llamarpc.com')
    },
    [],
  )

  const walletDisconnectedCb = useMemo(
    () => () => {
      setWalletAddress('')
      setIsConnected(false)
    },
    [],
  )

  useEffect(() => {
    invoke<string>('greet', { name: 'Blockchain Developer' }).then((greeting) => {
      console.log(greeting)
    })

    WalletService.addListener('walletConnected', walletConnectedCb)
    WalletService.addListener('walletDisconnected', walletDisconnectedCb)

    return () => {
      WalletService.removeListener('walletConnected', walletConnectedCb)
      WalletService.removeListener('walletDisconnected', walletDisconnectedCb)
    }
  }, [walletConnectedCb, walletDisconnectedCb])

  const handleCompile = async () => {
    setIsCompiling(true)
    try {
      const result = await SolidityCompiler.compile(code, true)
      setCompilationResult(result)
    } finally {
      setIsCompiling(false)
    }
  }

  const handleConnectWallet = async () => {
    try {
      if (activeChain === 'local') {
        alert('Wallet connect is for public chains. Use Local Chains + a test private key for local dev.')
        return
      }
      await WalletService.connectEthereum(activeChain)
    } catch (error: any) {
      console.error('Failed to connect wallet:', error)
      alert(`Failed to connect wallet: ${error?.message ?? String(error)}`)
    }
  }

  const handleDisconnectWallet = async () => {
    try {
      await WalletService.disconnect(activeChain)
      setPrivateKey('')
    } catch (error) {
      console.error('Failed to disconnect wallet:', error)
    }
  }

  const handleDeploy = async () => {
    if (!compilationResult?.success) {
      alert('Please compile the contract first')
      return
    }
    if (!privateKey && !isConnected && activeChain !== 'local') {
      alert('Please either connect a wallet, provide a private key, or use local chain')
      return
    }

    const contractName = Object.keys(compilationResult.contracts)[0]
    if (!contractName) {
      alert('No compiled contract found')
      return
    }

    try {
      const contract = compilationResult.contracts[contractName]
      setDeploymentStatus('Deploying...')
      setDeployedAddress('')

      if (isConnected && walletAddress) {
        const txHash = await WalletService.sendTransaction(activeChain, {
          from: walletAddress,
          data: `0x${contract.bin}`,
          gas: '0x300000',
          value: '0x0',
        })
        setDeploymentStatus(`Transaction sent: ${txHash}`)
      } else if (activeChain === 'local') {
        const result = await invoke<any>('deploy_contract', {
          bytecode: contract.bin,
          rpc_url: rpcUrl,
          private_key: (privateKey || DEFAULT_LOCAL_PRIVATE_KEY).trim(),
          chain_id: CHAIN_ID_MAP.local,
        })
        setDeployedAddress(result.address)
        setDeploymentStatus('Deployed successfully to local chain!')
      } else {
        const chain_id = CHAIN_ID_MAP[activeChain] ?? 1
        const result = await invoke<any>('deploy_contract', {
          bytecode: contract.bin,
          rpc_url: rpcUrl,
          private_key: privateKey.trim(),
          chain_id,
        })
        setDeployedAddress(result.address)
        setDeploymentStatus('Deployed successfully!')
      }
    } catch (error: any) {
      console.error('Deployment error:', error)
      setDeploymentStatus(`Deployment failed: ${error?.message ?? String(error)}`)
      alert(`Deployment failed: ${error?.message ?? String(error)}`)
    }
  }

  const handleSimulate = async () => {
    if (!compilationResult?.success) {
      alert('Please compile the contract first')
      return
    }

    const contractName = Object.keys(compilationResult.contracts)[0]
    if (!contractName) {
      alert('No compiled contract found')
      return
    }

    try {
      const contract = compilationResult.contracts[contractName]
      // getGreeting() selector
      const result = await invoke<any>('simulate_contract_execution', {
        bytecode: contract.bin,
        data: '6d4ce63c',
        value: '0',
        caller: '0x0000000000000000000000000000000000000000',
        gas_limit: 1000000,
      })
      alert(`Simulation ${result.success ? 'successful' : 'failed'}: ${result.output}`)
    } catch (error: any) {
      console.error('Simulation error:', error)
      alert(`Simulation failed: ${error?.message ?? String(error)}`)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>🚀 Blockchain IDE</h1>
        <div className="header-actions">
          <div className="tabs">
            <button className={`tab ${activeTab === 'editor' ? 'active' : ''}`} onClick={() => setActiveTab('editor')}>
              Editor
            </button>
            <button className={`tab ${activeTab === 'nodes' ? 'active' : ''}`} onClick={() => setActiveTab('nodes')}>
              Local Chains
            </button>
          </div>

          <div className="wallet-section">
            {isConnected ? (
              <>
                <span className="wallet-address">
                  {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                </span>
                <button onClick={handleDisconnectWallet} className="btn btn-disconnect">
                  Disconnect
                </button>
              </>
            ) : (
              <button onClick={handleConnectWallet} className="btn btn-connect">
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="main">
        {activeTab === 'nodes' ? (
          <NodeManager
            onUseRpcUrl={(u) => {
              setRpcUrl(u)
              setActiveChain('local')
            }}
            onUsePrivateKey={(pk) => setPrivateKey(pk)}
          />
        ) : (
          <>
            <div className="editor-section">
              <div className="editor-header">
                <h2>Smart Contract Editor</h2>
                <div className="editor-actions">
                  <button onClick={handleCompile} className="btn btn-compile" disabled={isCompiling}>
                    {isCompiling ? 'Compiling…' : 'Compile'}
                  </button>
                  <button onClick={handleSimulate} className="btn btn-simulate" disabled={!compilationResult?.success}>
                    Simulate
                  </button>
                  <button onClick={handleDeploy} className="btn btn-deploy" disabled={!compilationResult?.success}>
                    Deploy
                  </button>
                </div>
              </div>

              <textarea className="code-editor" value={code} onChange={(e) => setCode(e.target.value)} rows={20} spellCheck={false} />

              <div className="config-section">
                <h3>Deployment Configuration</h3>
                <div className="config-grid">
                  <div className="config-item">
                    <label>Target Chain:</label>
                    <select
                      value={activeChain}
                      onChange={(e) => {
                        const next = e.target.value
                        setActiveChain(next)
                        if (next === 'local') setRpcUrl(DEFAULT_LOCAL_RPC)
                      }}
                    >
                      <option value="local">Local Development Chain</option>
                      <option value="ethereum">Ethereum Mainnet</option>
                      <option value="polygon">Polygon</option>
                      <option value="bsc">BNB Smart Chain</option>
                      <option value="ethereum-sepolia">Ethereum Sepolia</option>
                    </select>
                  </div>
                  <div className="config-item">
                    <label>RPC URL:</label>
                    <input type="text" value={rpcUrl} onChange={(e) => setRpcUrl(e.target.value)} placeholder={DEFAULT_LOCAL_RPC} />
                  </div>
                  <div className="config-item">
                    <label>Private Key (optional):</label>
                    <input type="password" value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} placeholder="0x..." />
                  </div>
                </div>

                {activeChain === 'local' && (
                  <div className="local-chain-info">
                    <p>⚠️ Using local chain. Make sure Ganache or Anvil is running.</p>
                    <p>
                      Go to <strong>Local Chains</strong> tab to start a local node.
                    </p>
                  </div>
                )}

                {deploymentStatus && (
                  <div className="deployment-status">
                    {deploymentStatus}
                    {deployedAddress && (
                      <div className="deployed-address">
                        Contract: <code>{deployedAddress}</code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="results-section">
              <h2>Results</h2>

              {compilationResult && (
                <div className={`compilation-result ${compilationResult.success ? 'success' : 'error'}`}>
                  <h3>Compilation {compilationResult.success ? '✅ Success' : '❌ Failed'}</h3>

                  {!compilationResult.success && compilationResult.errors.length > 0 && (
                    <div className="errors">
                      <h4>Errors</h4>
                      <ul>
                        {compilationResult.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {compilationResult.success && Object.keys(compilationResult.contracts).length > 0 && (
                    <div className="contracts">
                      <h4>Compiled Contracts</h4>
                      <ul>
                        {Object.entries(compilationResult.contracts).map(([name, contract]) => (
                          <li key={name}>
                            <strong>{name}</strong>
                            <div className="contract-info">
                              <span>Bytecode: {contract.bin.length} bytes</span>
                              <span>ABI: {contract.abi?.length || 0} items</span>
                            </div>
                            {contract.abi && (
                              <div className="abi-preview">
                                <h5>ABI Preview:</h5>
                                <pre>{JSON.stringify(contract.abi.slice(0, 3), null, 2)}...</pre>
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default App

