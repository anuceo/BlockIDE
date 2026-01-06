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

  const useNode = (node: NodeStatus) => {
    onUseRpcUrl?.(node.rpc_url)
    onUseChainId?.(node.chain_id)
  }

  const useAccount = (acct: LocalAccount) => {
    onUsePrivateKey?.(acct.private_key)
  }

  return (
    <section className="node-manager">
      <div className="node-manager-header">
        <h3>Local Development Chain</h3>
      </div>

      <div className="node-manager-config">
        <div className="node-manager-grid">
          <div className="config-item">
            <label>Node Type</label>
            <select value={config.type} onChange={(e) => setConfig({ ...config, type: e.target.value as any })}>
              <option value="ganache">Ganache</option>
              <option value="anvil">Anvil (Foundry)</option>
            </select>
          </div>
          <div className="config-item">
            <label>Port</label>
            <input
              type="number"
              min={1024}
              max={65535}
              value={config.port}
              onChange={(e) => setConfig({ ...config, port: Number(e.target.value) || 8545 })}
            />
          </div>
          <div className="config-item">
            <label>Chain ID</label>
            <input type="number" value={config.chainId} onChange={(e) => setConfig({ ...config, chainId: Number(e.target.value) || 1337 })} />
          </div>
          {config.type === 'ganache' && (
            <>
              <div className="config-item">
                <label>Accounts</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={config.accounts}
                  onChange={(e) => setConfig({ ...config, accounts: Number(e.target.value) || 10 })}
                />
              </div>
              <div className="config-item">
                <label>Block Time (s)</label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  value={config.blockTime}
                  onChange={(e) => setConfig({ ...config, blockTime: Number(e.target.value) || 0 })}
                />
              </div>
            </>
          )}
        </div>

        {config.type === 'ganache' && (
          <div className="config-item full-width">
            <label>Mnemonic</label>
            <textarea value={config.mnemonic} onChange={(e) => setConfig({ ...config, mnemonic: e.target.value })} rows={2} />
          </div>
        )}

        <button onClick={startNode} className="btn btn-start" disabled={isStarting}>
          {isStarting ? 'Starting…' : 'Start Local Chain'}
        </button>
      </div>

      <div className="node-manager-nodes">
        <h4>Running Nodes</h4>
        {nodes.length === 0 ? (
          <div className="node-empty">No local nodes running.</div>
        ) : (
          <div className="node-cards">
            {nodes.map((n) => (
              <div key={n.pid} className="node-card">
                <div className="node-card-top">
                  <div>
                    <div className="node-title">{n.rpc_url}</div>
                    <div className="node-meta">
                      <span className="badge">PID {n.pid}</span>
                      <span className="badge">Chain {n.chain_id}</span>
                      <span className={`badge ${n.is_running ? 'badge-running' : 'badge-stopped'}`}>
                        {n.is_running ? 'Running' : 'Stopped'}
                      </span>
                    </div>
                  </div>
                  <div className="node-actions">
                    <button className="btn btn-small btn-secondary" onClick={() => useNode(n)}>
                      Use RPC
                    </button>
                    <button className="btn btn-small btn-secondary" onClick={() => loadAccounts(n.pid)}>
                      Accounts
                    </button>
                    <button className="btn btn-small btn-danger" onClick={() => stopNode(n.pid)}>
                      Stop
                    </button>
                  </div>
                </div>

                <div className="node-logs">
                  <div className="node-logs-title">Recent logs</div>
                  <div className="logs-container">
                    {(n.logs ?? []).slice(-5).map((l, idx) => (
                      <div key={idx} className="log-entry">
                        {l}
                      </div>
                    ))}
                  </div>
                </div>

                {selectedPid === n.pid && accounts.length > 0 && (
                  <div className="node-accounts">
                    <div className="node-logs-title">Test accounts</div>
                    <div className="accounts-grid">
                      {accounts.slice(0, 5).map((a, idx) => (
                        <div key={idx} className="account-card">
                          <div className="account-row">
                            <span className="badge">#{idx + 1}</span>
                            <button className="btn btn-small btn-secondary" onClick={() => useAccount(a)}>
                              Use PK
                            </button>
                          </div>
                          <div className="mono">{a.address}</div>
                          <div className="mono dim">{a.private_key.slice(0, 10)}…</div>
                        </div>
                      ))}
                    </div>
                    <div className="node-hint">Tip: click “Use RPC” then “Use PK” to fill the deploy form.</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

