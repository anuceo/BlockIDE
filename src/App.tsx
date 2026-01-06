import { invoke } from '@tauri-apps/api/core'
import { useEffect, useMemo, useState } from 'react'
import { WalletService, type WalletConnection } from './services/blockchain/WalletService'
import { SolidityCompiler, type CompilationResult } from './services/compiler/SolidityCompiler'
import './App.css'

function App() {
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
  const [activeChain, setActiveChain] = useState<string>('ethereum')

  const walletConnectedCb = useMemo(
    () => (connection: WalletConnection) => {
      setWalletAddress(connection.address)
      setIsConnected(true)
      setActiveChain(connection.chain.id)
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
      await WalletService.connectEthereum(activeChain)
    } catch (error: any) {
      console.error('Failed to connect wallet:', error)
      alert(`Failed to connect wallet: ${error?.message ?? String(error)}`)
    }
  }

  const handleDisconnectWallet = async () => {
    try {
      await WalletService.disconnect(activeChain)
    } catch (error) {
      console.error('Failed to disconnect wallet:', error)
    }
  }

  const handleDeploy = async () => {
    if (!compilationResult?.success) {
      alert('Please compile the contract first')
      return
    }
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }

    const contractName = Object.keys(compilationResult.contracts)[0]
    if (!contractName) {
      alert('No compiled contract found')
      return
    }

    try {
      const contract = compilationResult.contracts[contractName]
      const result = await invoke<any>('deploy_contract', {
        bytecode: contract.bin,
        value: '0',
        gas_limit: 1000000,
      })
      alert(`Contract deployed at: ${result.address}`)
    } catch (error: any) {
      console.error('Deployment error:', error)
      alert(`Deployment failed: ${error?.message ?? String(error)}`)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>Blockchain IDE</h1>
        <div className="wallet-section">
          <select value={activeChain} onChange={(e) => setActiveChain(e.target.value)} className="chain-select">
            <option value="ethereum">Ethereum</option>
            <option value="polygon">Polygon</option>
            <option value="bsc">BSC</option>
            <option value="ethereum-sepolia">Sepolia</option>
          </select>

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
      </header>

      <main className="main">
        <div className="editor-section">
          <div className="editor-header">
            <h2>Smart Contract Editor</h2>
            <div className="editor-actions">
              <button onClick={handleCompile} className="btn btn-compile" disabled={isCompiling}>
                {isCompiling ? 'Compiling…' : 'Compile'}
              </button>
              <button
                onClick={handleDeploy}
                className="btn btn-deploy"
                disabled={!compilationResult?.success || !isConnected}
              >
                Deploy (mock)
              </button>
            </div>
          </div>

          <textarea
            className="code-editor"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={20}
            spellCheck={false}
          />
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
                          <span>Bytecode: {contract.bin.length} hex chars</span>
                          <span>ABI: {contract.abi?.length ?? 0} items</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {compilationResult.warnings.length > 0 && (
                <div className="warnings">
                  <h4>Warnings</h4>
                  <ul>
                    {compilationResult.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default App

