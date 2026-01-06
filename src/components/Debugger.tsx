import { invoke } from '@tauri-apps/api/core'
import { useEffect, useMemo, useRef, useState } from 'react'

interface DebugStep {
  pc: number
  opcode: string
  gas: number
  gas_cost: number
  depth: number
  stack: string[]
  memory: string[]
  storage: Record<string, string>
  contract_address: string
  caller: string
  value: string
}

interface Breakpoint {
  line: number
  enabled: boolean
  condition?: string
}

interface DebugSession {
  session_id: string
  bytecode: string
  deployed_address: string
  breakpoints: Breakpoint[]
  current_step?: DebugStep
  steps: DebugStep[]
  completed: boolean
}

interface DebugResult {
  session_id: string
  steps: DebugStep[]
  final_output: string
  gas_used: number
  success: boolean
  error?: string | null
}

interface Props {
  code: string
  compilationResult?: any
  onBreakpointToggle?: (line: number) => void
}

export function Debugger({ code, compilationResult, onBreakpointToggle }: Props) {
  const [session, setSession] = useState<DebugSession | null>(null)
  const [isDebugging, setIsDebugging] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(-1)
  const [breakpoints, setBreakpoints] = useState<number[]>([])
  const [executionSpeed, setExecutionSpeed] = useState(750)
  const [isPlaying, setIsPlaying] = useState(false)
  const [watchVariables, setWatchVariables] = useState<string[]>(['msg.sender', 'msg.value', 'gasleft()'])
  const [newWatchVar, setNewWatchVar] = useState('')

  const isBusyRef = useRef(false)

  useEffect(() => {
    const lines = code.split('\n')
    const newBreakpoints: number[] = []
    lines.forEach((line, index) => {
      if (line.includes('require') || line.includes('revert') || line.includes('assert') || line.includes('emit')) {
        newBreakpoints.push(index + 1)
      }
    })
    setBreakpoints(newBreakpoints)
  }, [code])

  const firstContractBin = useMemo(() => {
    if (!compilationResult?.success) return null
    const name = Object.keys(compilationResult.contracts ?? {})[0]
    if (!name) return null
    return compilationResult.contracts[name]?.bin ?? null
  }, [compilationResult])

  const startDebugging = async () => {
    if (!firstContractBin) {
      alert('Please compile the contract first')
      return
    }

    setIsDebugging(true)
    setIsPlaying(false)
    try {
      const s = await invoke<DebugSession>('create_debug_session', {
        bytecode: firstContractBin,
        initial_data: '0x',
        value: '0x0',
        caller: '0x0000000000000000000000000000000000000000',
      })
      setSession(s)
      setCurrentStepIndex(-1)
    } catch (error: any) {
      alert(`Failed to start debugging: ${error?.message ?? String(error)}`)
      setIsDebugging(false)
    }
  }

  const applyResultSteps = (result: DebugResult) => {
    if (!session) return
    if (!result.steps || result.steps.length === 0) {
      setSession({ ...session, completed: true })
      setIsPlaying(false)
      return
    }

    const newSteps = [...session.steps, ...result.steps]
    setSession({
      ...session,
      steps: newSteps,
      current_step: result.steps[result.steps.length - 1],
    })
    setCurrentStepIndex(newSteps.length - 1)
  }

  const executeSteps = async (count: number) => {
    if (!session) return
    if (isBusyRef.current) return
    isBusyRef.current = true

    try {
      const result = await invoke<DebugResult>('execute_step', {
        session_id: session.session_id,
        steps: count,
      })
      applyResultSteps(result)

      if (result.error) {
        console.warn('Debugger error:', result.error)
      }
    } catch (error: any) {
      console.error('Step execution failed:', error)
      setIsPlaying(false)
    } finally {
      isBusyRef.current = false
    }
  }

  useEffect(() => {
    if (!isPlaying) return
    if (!session) return

    const id = window.setInterval(() => {
      void executeSteps(1)
    }, Math.max(50, executionSpeed))

    return () => window.clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying, executionSpeed, session?.session_id])

  const toggleBreakpoint = (line: number) => {
    if (!session) return

    if (breakpoints.includes(line)) {
      setBreakpoints(breakpoints.filter((l) => l !== line))
      void invoke('remove_breakpoint', {
        session_id: session.session_id,
        line,
      })
    } else {
      setBreakpoints([...breakpoints, line])
      void invoke('set_breakpoint', {
        session_id: session.session_id,
        line,
        condition: undefined,
      })
    }

    onBreakpointToggle?.(line)
  }

  const addWatchVariable = () => {
    const v = newWatchVar.trim()
    if (v && !watchVariables.includes(v)) {
      setWatchVariables([...watchVariables, v])
      setNewWatchVar('')
    }
  }

  const removeWatchVariable = (variable: string) => {
    setWatchVariables(watchVariables.filter((v) => v !== variable))
  }

  const formatGas = (gas: number) => {
    if (gas > 1_000_000) return `${(gas / 1_000_000).toFixed(2)}M`
    if (gas > 1_000) return `${(gas / 1_000).toFixed(2)}K`
    return gas.toString()
  }

  const formatHex = (hex: string, maxLength: number = 16) => {
    if (hex.length <= maxLength) return hex
    return `${hex.slice(0, maxLength / 2)}...${hex.slice(-maxLength / 2)}`
  }

  const getOpcodeColor = (opcode: string) => {
    if (opcode.includes('PUSH')) return 'text-blue-400'
    if (opcode.includes('JUMP')) return 'text-green-400'
    if (opcode.includes('CALL')) return 'text-yellow-400'
    if (opcode.includes('STOP') || opcode.includes('RETURN') || opcode.includes('REVERT')) return 'text-red-400'
    return 'text-gray-400'
  }

  if (!isDebugging) {
    return (
      <div className="debugger-start">
        <div className="start-header">
          <h3>EVM Debugger</h3>
          <p className="start-description">Step through your contract execution and inspect EVM state per opcode.</p>
        </div>

        <div className="debugger-features">
          <div className="feature">
            <div className="feature-icon">🔍</div>
            <h4>Step-by-Step Execution</h4>
            <p>Execute one EVM opcode at a time</p>
          </div>
          <div className="feature">
            <div className="feature-icon">💾</div>
            <h4>Memory Inspection</h4>
            <p>View memory in 32-byte chunks</p>
          </div>
          <div className="feature">
            <div className="feature-icon">⚡</div>
            <h4>Gas Analysis</h4>
            <p>Track gas usage per opcode</p>
          </div>
          <div className="feature">
            <div className="feature-icon">🎯</div>
            <h4>Breakpoints</h4>
            <p>Toggle breakpoints (UI-only for now)</p>
          </div>
        </div>

        <div className="start-actions">
          <button onClick={startDebugging} disabled={!compilationResult?.success} className="btn btn-debug-start">
            {compilationResult?.success ? 'Start Debugging' : 'Compile First to Debug'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="debugger-container">
      <div className="debugger-header">
        <div className="session-info">
          <h3>Debug Session</h3>
          <div className="session-meta">
            <span className="meta-item">
              <span className="meta-label">Contract:</span>
              <span className="meta-value">{formatHex(session?.deployed_address || '')}</span>
            </span>
            <span className="meta-item">
              <span className="meta-label">Steps:</span>
              <span className="meta-value">{session?.steps.length || 0}</span>
            </span>
            <span className="meta-item">
              <span className="meta-label">Breakpoints:</span>
              <span className="meta-value">{breakpoints.length}</span>
            </span>
          </div>
        </div>

        <div className="debugger-controls">
          <div className="control-group">
            <button onClick={() => executeSteps(1)} className="btn btn-step" title="Step Over">
              Step
            </button>
            <button onClick={() => executeSteps(10)} className="btn btn-step-multi" title="Step 10 Operations">
              Step 10
            </button>
            <button onClick={() => executeSteps(100)} className="btn btn-step-multi" title="Step 100 Operations">
              Step 100
            </button>
          </div>

          <div className="control-group">
            <label className="speed-control">
              <span>Speed:</span>
              <input type="range" min="50" max="2000" value={executionSpeed} onChange={(e) => setExecutionSpeed(parseInt(e.target.value, 10))} />
              <span>{executionSpeed}ms</span>
            </label>

            <button onClick={() => setIsPlaying(!isPlaying)} className={`btn ${isPlaying ? 'btn-pause' : 'btn-play'}`}>
              {isPlaying ? 'Pause' : 'Play'}
            </button>
          </div>
        </div>
      </div>

      <div className="debugger-main">
        <div className="execution-panel">
          <h4>Execution Trace</h4>
          <div className="steps-list">
            {session?.steps.slice(-20).map((step, idx) => {
              const adjustedIndex = Math.max(0, (session.steps.length - 20)) + idx
              const isCurrent = adjustedIndex === currentStepIndex
              return (
                <div key={adjustedIndex} className={`step-item ${isCurrent ? 'current' : ''}`} onClick={() => setCurrentStepIndex(adjustedIndex)}>
                  <div className="step-header">
                    <span className="step-pc">PC: {step.pc}</span>
                    <span className={`step-opcode ${getOpcodeColor(step.opcode)}`}>{step.opcode}</span>
                    <span className="step-gas">
                      Gas: {formatGas(step.gas)} (-{step.gas_cost})
                    </span>
                  </div>
                  <div className="step-details">
                    <div className="step-depth">Depth: {step.depth}</div>
                    <div className="step-address">Contract: {formatHex(step.contract_address)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="inspection-panel">
          <div className="panel-tabs">
            <button className="tab active">Stack</button>
            <button className="tab">Memory</button>
            <button className="tab">Storage</button>
            <button className="tab">Watch</button>
          </div>

          <div className="panel-content">
            <div className="stack-view">
              <h5>Stack ({session?.current_step?.stack.length || 0} items)</h5>
              <div className="stack-items">
                {session?.current_step?.stack.map((item, index) => (
                  <div key={index} className="stack-item">
                    <span className="stack-index">{index}:</span>
                    <code className="stack-value">{formatHex(item)}</code>
                  </div>
                ))}
              </div>
            </div>

            <div className="watch-view">
              <h5>Watch Variables</h5>
              <div className="watch-input">
                <input
                  type="text"
                  value={newWatchVar}
                  onChange={(e) => setNewWatchVar(e.target.value)}
                  placeholder="Enter variable name (e.g., msg.sender)"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addWatchVariable()
                  }}
                />
                <button onClick={addWatchVariable} className="btn btn-small">
                  Add
                </button>
              </div>
              <div className="watch-list">
                {watchVariables.map((variable, index) => (
                  <div key={index} className="watch-item">
                    <span className="watch-name">{variable}</span>
                    <span className="watch-value">[value]</span>
                    <button onClick={() => removeWatchVariable(variable)} className="btn-remove" title="Remove">
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {session?.current_step && (
              <div className="current-step-details">
                <h5>Current Operation</h5>
                <div className="details-grid">
                  <div className="detail-item">
                    <span className="detail-label">PC:</span>
                    <span className="detail-value">{session.current_step.pc}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Opcode:</span>
                    <span className="detail-value">{session.current_step.opcode}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Gas Remaining:</span>
                    <span className="detail-value">{formatGas(session.current_step.gas)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Gas Cost:</span>
                    <span className="detail-value">{session.current_step.gas_cost}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Caller:</span>
                    <span className="detail-value">{formatHex(session.current_step.caller)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Value:</span>
                    <span className="detail-value">{session.current_step.value}</span>
                  </div>
                </div>
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <button
                className="btn btn-secondary btn-small"
                onClick={() => {
                  const line = 1
                  toggleBreakpoint(line)
                }}
                title="Example breakpoint toggle"
              >
                Toggle breakpoint (line 1)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

