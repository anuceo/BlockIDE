import { invoke } from '@tauri-apps/api/core'
import { useMemo, useState } from 'react'

type TestFramework = 'Hardhat' | 'Foundry' | 'Truffle'

interface TestResult {
  name: string
  passed: boolean
  duration: number
  error?: string
  logs: string[]
}

interface TestSuiteResult {
  framework: string
  total: number
  passed: number
  failed: number
  duration: number
  results: TestResult[]
  coverage?: {
    statements: number
    branches: number
    functions: number
    lines: number
  }
}

interface Props {
  code: string
  compilationResult?: any
}

export function TestRunner({ code, compilationResult }: Props) {
  const [isRunning, setIsRunning] = useState(false)
  const [selectedFramework, setSelectedFramework] = useState<TestFramework>('Hardhat')
  const [results, setResults] = useState<TestSuiteResult | null>(null)

  const defaultHardhatTest = useMemo(
    () => `const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TestContract", function () {
  it("deploys", async function () {
    const Contract = await ethers.getContractFactory("TestContract");
    const contract = await Contract.deploy();
    await contract.waitForDeployment();
    expect(await contract.getAddress()).to.not.equal(ethers.ZeroAddress);
  });
});
`,
    [],
  )

  const [testCode, setTestCode] = useState<string>(defaultHardhatTest)

  const runTests = async () => {
    if (!compilationResult?.success) {
      alert('Please compile the contract first')
      return
    }

    setIsRunning(true)
    setResults(null)

    try {
      const result = await invoke<TestSuiteResult>('run_tests', {
        code,
        testCode,
        framework: selectedFramework,
        optimize: true,
      })
      setResults(result)
    } catch (error: any) {
      console.error('Test execution failed:', error)
      alert(`Tests failed: ${error?.message ?? String(error)}`)
    } finally {
      setIsRunning(false)
    }
  }

  const formatDuration = (seconds: number) => {
    if (seconds < 1) return `${Math.round(seconds * 1000)}ms`
    return `${seconds.toFixed(2)}s`
  }

  const getCoverageColor = (pct: number) => {
    if (pct >= 80) return 'text-green-400'
    if (pct >= 60) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <div className="test-runner">
      <div className="test-header">
        <h3>Smart Contract Testing</h3>
        <div className="test-controls">
          <div className="framework-selector">
            <label>Framework:</label>
            <select
              value={selectedFramework}
              onChange={(e) => setSelectedFramework(e.target.value as TestFramework)}
              className="framework-dropdown"
            >
              <option value="Hardhat">Hardhat</option>
              <option value="Foundry">Foundry</option>
              <option value="Truffle">Truffle</option>
            </select>
          </div>

          <div className="test-actions">
            <button
              onClick={() => navigator.clipboard.writeText(testCode)}
              className="btn btn-template"
              title="Copy test code"
            >
              Copy
            </button>
            <button onClick={runTests} disabled={isRunning || !compilationResult?.success} className="btn btn-run-tests">
              {isRunning ? 'Running…' : 'Run Tests'}
            </button>
          </div>
        </div>
      </div>

      <div className="test-editor-section">
        <div className="editor-header">
          <h4>Test Code</h4>
        </div>
        <textarea className="test-editor" value={testCode} onChange={(e) => setTestCode(e.target.value)} rows={15} spellCheck={false} />
      </div>

      {results && (
        <div className="test-results">
          <div className="results-summary">
            <div className="summary-card total">
              <div className="summary-value">{results.total}</div>
              <div className="summary-label">Total</div>
            </div>
            <div className="summary-card passed">
              <div className="summary-value">{results.passed}</div>
              <div className="summary-label">Passed</div>
            </div>
            <div className="summary-card failed">
              <div className="summary-value">{results.failed}</div>
              <div className="summary-label">Failed</div>
            </div>
            <div className="summary-card duration">
              <div className="summary-value">{formatDuration(results.duration)}</div>
              <div className="summary-label">Duration</div>
            </div>
            <div className="summary-card framework">
              <div className="summary-value">{results.framework}</div>
              <div className="summary-label">Framework</div>
            </div>
          </div>

          {results.coverage && (
            <div className="coverage-report">
              <h5>Code Coverage</h5>
              <div className="coverage-grid">
                <div className="coverage-item">
                  <div className="coverage-label">Statements</div>
                  <div className={`coverage-value ${getCoverageColor(results.coverage.statements)}`}>{results.coverage.statements.toFixed(1)}%</div>
                </div>
                <div className="coverage-item">
                  <div className="coverage-label">Branches</div>
                  <div className={`coverage-value ${getCoverageColor(results.coverage.branches)}`}>{results.coverage.branches.toFixed(1)}%</div>
                </div>
                <div className="coverage-item">
                  <div className="coverage-label">Functions</div>
                  <div className={`coverage-value ${getCoverageColor(results.coverage.functions)}`}>{results.coverage.functions.toFixed(1)}%</div>
                </div>
                <div className="coverage-item">
                  <div className="coverage-label">Lines</div>
                  <div className={`coverage-value ${getCoverageColor(results.coverage.lines)}`}>{results.coverage.lines.toFixed(1)}%</div>
                </div>
              </div>
            </div>
          )}

          <div className="detailed-results">
            <h5>Test Results</h5>
            <div className="results-list">
              {results.results.map((t, i) => (
                <div key={i} className={`test-result ${t.passed ? 'passed' : 'failed'}`}>
                  <div className="test-header">
                    <div className="test-status">{t.passed ? '✅' : '❌'}</div>
                    <div className="test-name">{t.name}</div>
                    <div className="test-duration">{formatDuration(t.duration)}</div>
                  </div>
                  {t.error && (
                    <div className="test-error">
                      <strong>Error:</strong> {t.error}
                    </div>
                  )}
                  {t.logs?.length ? (
                    <div className="test-logs">
                      <strong>Logs:</strong>
                      <ul>
                        {t.logs.map((l, j) => (
                          <li key={j}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!results && (
        <div className="test-guide">
          <div className="guide-header">
            <h4>Testing Guide</h4>
          </div>
          <div className="guide-content">
            <div className="framework-guides">
              <div className="framework-guide">
                <h5>Hardhat</h5>
                <ul>
                  <li>JavaScript tests via Mocha</li>
                  <li>Local in-memory chain</li>
                  <li>Good plugin ecosystem</li>
                </ul>
              </div>
              <div className="framework-guide">
                <h5>Foundry</h5>
                <ul>
                  <li>Fast `forge test`</li>
                  <li>Solidity-based tests</li>
                  <li>Fuzzing support</li>
                </ul>
              </div>
              <div className="framework-guide">
                <h5>Truffle</h5>
                <ul>
                  <li>Mature test runner</li>
                  <li>Useful for migrations</li>
                  <li>Good for legacy projects</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

