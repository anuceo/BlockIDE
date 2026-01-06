import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useEffect, useMemo, useState } from 'react'

export type NodeStatus = {
  pid: number
  port: number
  rpc_url: string
  chain_id: number
  started_at: number
  is_running: boolean
  logs: string[]
}

export type LocalAccount = {
  address: string
  private_key: string
  balance: string
}

type Props = {
  onUseRpcUrl?: (rpcUrl: string) => void
  onUseChainId?: (chainId: number) => void
  onUsePrivateKey?: (privateKey: string) => void
}

export function NodeManager({ onUseRpcUrl, onUseChainId, onUsePrivateKey }: Props) {
  const [nodes, setNodes] = useState<NodeStatus[]>([])
  const [selectedPid, setSelectedPid] = useState<number | null>(null)
  const [accounts, setAccounts] = useState<LocalAccount[]>([])
  const [isStarting, setIsStarting] = useState(false)

  const [config, setConfig] = useState({
    type: 'ganache' as 'ganache' | 'anvil',
    port: 8545,
    chainId: 1337,
    accounts: 10,
    mnemonic: 'test test test test test test test test test test test junk',
    blockTime: 0,
  })

  const refreshNodes = useMemo(
    () => async () => {
      const list = await invoke<NodeStatus[]>('get_nodes')
      setNodes(list)
    },
    [],
  )

  useEffect(() => {
    void refreshNodes()

    const unlistenLogPromise = listen<[number, string]>('node-log', (event) => {
      const [pid, line] = event.payload
      setNodes((prev) =>
        prev.map((n) => {
          if (n.pid !== pid) return n
          const logs = [...(n.logs ?? []), line]
          return { ...n, logs: logs.slice(-200) }
        }),
      )
    })

    const unlistenStoppedPromise = listen<number>('node-stopped', (event) => {
      const pid = event.payload
      setNodes((prev) => prev.filter((n) => n.pid !== pid))
      if (selectedPid === pid) {
        setSelectedPid(null)
        setAccounts([])
      }
    })

    return () => {
      void unlistenLogPromise.then((f) => f())
      void unlistenStoppedPromise.then((f) => f())
    }
  }, [refreshNodes, selectedPid])

  const startNode = async () => {
    setIsStarting(true)
    try {
      if (config.type === 'ganache') {
        await invoke('start_ganache', {
          port: config.port,
          chain_id: config.chainId,
          accounts: config.accounts,
          mnemonic: config.mnemonic || undefined,
          block_time: config.blockTime ? config.blockTime : undefined,
        })
      } else {
        await invoke('start_anvil', {
          port: config.port,
          chain_id: config.chainId,
        })
      }
      await refreshNodes()
    } catch (e: any) {
      alert(`Failed to start node: ${e?.message ?? String(e)}`)
    } finally {
      setIsStarting(false)
    }
  }

  const stopNode = async (pid: number) => {
    try {
      await invoke('stop_node', { pid })
    } catch (e: any) {
      alert(`Failed to stop node: ${e?.message ?? String(e)}`)
    }
  }

  const loadAccounts = async (pid: number) => {
    try {
      const list = await invoke<LocalAccount[]>('get_default_accounts', { pid })
      setAccounts(list)
      setSelectedPid(pid)
    } catch (e: any) {
      alert(`Failed to load accounts: ${e?.message ?? String(e)}`)
    }
  }

  const applyNode = (node: NodeStatus) => {
    onUseRpcUrl?.(node.rpc_url)
    onUseChainId?.(node.chain_id)
  }

  const applyAccount = (acct: LocalAccount) => {
    onUsePrivateKey?.(acct.private_key)
  }

  const formatBalance = (balance: string) => {
    try {
      const wei = BigInt(balance)
      const ether = Number(wei) / 1e18
      return `${ether.toFixed(2)} ETH`
    } catch {
      return balance
    }
  }

  return (
    <div className="node-manager">
      <div className="node-config">
        <h3>Local Development Chain</h3>

        <div className="config-grid">
          <div className="config-item">
            <label>Node Type:</label>
            <select value={config.type} onChange={(e) => setConfig({ ...config, type: e.target.value as any })}>
              <option value="ganache">Ganache</option>
              <option value="anvil">Anvil (Foundry)</option>
            </select>
          </div>

          <div className="config-item">
            <label>Port:</label>
            <input
              type="number"
              value={config.port}
              onChange={(e) => setConfig({ ...config, port: Number(e.target.value) || 8545 })}
              min={1024}
              max={65535}
            />
          </div>

          <div className="config-item">
            <label>Chain ID:</label>
            <input type="number" value={config.chainId} onChange={(e) => setConfig({ ...config, chainId: Number(e.target.value) || 1337 })} />
          </div>

          {config.type === 'ganache' && (
            <>
              <div className="config-item">
                <label>Accounts:</label>
                <input
                  type="number"
                  value={config.accounts}
                  onChange={(e) => setConfig({ ...config, accounts: Number(e.target.value) || 10 })}
                  min={1}
                  max={100}
                />
              </div>

              <div className="config-item">
                <label>Block Time (seconds, 0 = instant):</label>
                <input
                  type="number"
                  value={config.blockTime}
                  onChange={(e) => setConfig({ ...config, blockTime: Number(e.target.value) || 0 })}
                  min={0}
                  max={60}
                />
              </div>
            </>
          )}
        </div>

        <div className="config-item full-width">
          <label>Mnemonic (optional):</label>
          <textarea value={config.mnemonic} onChange={(e) => setConfig({ ...config, mnemonic: e.target.value })} rows={2} />
        </div>

        <button onClick={startNode} className="btn btn-start" disabled={isStarting}>
          {isStarting ? 'Starting...' : 'Start Local Chain'}
        </button>
      </div>

      <div className="nodes-list">
        <h3>Running Nodes</h3>

        {nodes.length === 0 ? (
          <div className="no-nodes">
            <p>No local nodes running. Start one above to begin development.</p>
            <div className="node-tips">
              <h4>Tips:</h4>
              <ul>
                <li>Ganache provides a full Ethereum simulation</li>
                <li>Anvil is faster and part of the Foundry suite</li>
                <li>Default accounts come with 1000 ETH each</li>
                <li>Transactions are instant (no mining delay)</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="nodes-grid">
            {nodes.map((node) => (
              <div key={node.pid} className="node-card">
                <div className="node-header">
                  <div className="node-info">
                    <h4>{node.rpc_url}</h4>
                    <div className="node-meta">
                      <span className="badge">PID: {node.pid}</span>
                      <span className="badge">Chain ID: {node.chain_id}</span>
                      <span className={`badge ${node.is_running ? 'badge-running' : ''}`}>
                        {node.is_running ? 'Running' : 'Stopped'}
                      </span>
                    </div>
                  </div>
                  <div className="node-actions">
                    <button onClick={() => applyNode(node)} className="btn btn-small btn-secondary">
                      Use RPC
                    </button>
                    <button onClick={() => loadAccounts(node.pid)} className="btn btn-small btn-secondary">
                      Show Accounts
                    </button>
                    <button onClick={() => stopNode(node.pid)} className="btn btn-small btn-danger">
                      Stop
                    </button>
                  </div>
                </div>

                <div className="node-logs">
                  <h5>Recent Logs:</h5>
                  <div className="logs-container">
                    {(node.logs ?? []).slice(-10).map((log, idx) => (
                      <div key={idx} className="log-entry">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>

                {selectedPid === node.pid && accounts.length > 0 && (
                  <div className="node-accounts">
                    <h5>Test Accounts:</h5>
                    <div className="accounts-grid">
                      {accounts.map((account, idx) => (
                        <div key={idx} className="account-card">
                          <div className="account-header">
                            <span className="account-index">Account #{idx + 1}</span>
                            <span className="account-balance">{formatBalance(account.balance)}</span>
                          </div>

                          <div className="account-address">
                            <code>{account.address}</code>
                            <button className="btn-icon" onClick={() => navigator.clipboard.writeText(account.address)} title="Copy address">
                              📋
                            </button>
                          </div>

                          <div className="account-private-key">
                            <input type="password" value={account.private_key} readOnly />
                            <button className="btn-icon" onClick={() => navigator.clipboard.writeText(account.private_key)} title="Copy private key">
                              🔑
                            </button>
                          </div>

                          <div className="account-actions">
                            <button className="btn btn-small btn-primary" onClick={() => applyAccount(account)}>
                              Use This Account
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

