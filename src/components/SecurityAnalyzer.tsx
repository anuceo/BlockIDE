import { invoke } from '@tauri-apps/api/core'
import { useMemo, useState } from 'react'

export type Vulnerability = {
  severity: string
  category: string
  title: string
  description: string
  recommendation: string
  line_start?: number
  line_end?: number
  swc_id?: string
}

export type SecuritySummary = {
  high: number
  medium: number
  low: number
  informational: number
  total: number
}

export type SecurityReport = {
  tool: string
  version: string
  vulnerabilities: Vulnerability[]
  summary: SecuritySummary
  passed: boolean
}

type Props = {
  code: string
  onVulnerabilityClick?: (line: number) => void
}

export function SecurityAnalyzer({ code, onVulnerabilityClick }: Props) {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [selectedTools, setSelectedTools] = useState<string[]>(['slither', 'mythril', 'solhint'])
  const [reports, setReports] = useState<SecurityReport[]>([])
  const [selectedReport, setSelectedReport] = useState<number>(0)
  const [error, setError] = useState<string>('')

  const tools = useMemo(
    () => [
      { id: 'slither', name: 'Slither', description: 'Static analysis framework' },
      { id: 'mythril', name: 'Mythril', description: 'Symbolic execution tool' },
      { id: 'solhint', name: 'Solhint', description: 'Solidity linter' },
    ],
    [],
  )

  const analyze = async () => {
    if (selectedTools.length === 0) {
      setError('Please select at least one analysis tool')
      return
    }

    setIsAnalyzing(true)
    setError('')

    try {
      const results = await invoke<SecurityReport[]>('analyze_security', {
        code,
        tools: selectedTools,
      })
      setReports(results)
      setSelectedReport(0)
    } catch (e: any) {
      setError(`Analysis failed: ${e?.message ?? String(e)}`)
    } finally {
      setIsAnalyzing(false)
    }
  }

  const totalSummary = reports.reduce(
    (acc, report) => ({
      high: acc.high + report.summary.high,
      medium: acc.medium + report.summary.medium,
      low: acc.low + report.summary.low,
      informational: acc.informational + report.summary.informational,
      total: acc.total + report.summary.total,
    }),
    { high: 0, medium: 0, low: 0, informational: 0, total: 0 },
  )

  return (
    <div className="security-analyzer">
      <div className="analyzer-header">
        <h3>Security Analysis</h3>
        <div className="analyzer-controls">
          <div className="tool-selection">
            {tools.map((tool) => (
              <label key={tool.id} className="tool-checkbox">
                <input
                  type="checkbox"
                  checked={selectedTools.includes(tool.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedTools([...selectedTools, tool.id])
                    } else {
                      setSelectedTools(selectedTools.filter((t) => t !== tool.id))
                    }
                  }}
                />
                <span className="tool-name">{tool.name}</span>
                <span className="tool-desc">{tool.description}</span>
              </label>
            ))}
          </div>
          <button onClick={analyze} disabled={isAnalyzing} className="btn btn-analyze">
            {isAnalyzing ? 'Analyzing...' : 'Run Security Scan'}
          </button>
        </div>
      </div>

      {error && (
        <div className="analysis-error">
          <span className="error-icon">⚠️</span>
          {error}
        </div>
      )}

      {reports.length > 0 ? (
        <div className="analysis-results">
          <div className="results-header">
            <div className="results-summary">
              <div className="summary-item">
                <span className="summary-count high">{totalSummary.high}</span>
                <span className="summary-label">High</span>
              </div>
              <div className="summary-item">
                <span className="summary-count medium">{totalSummary.medium}</span>
                <span className="summary-label">Medium</span>
              </div>
              <div className="summary-item">
                <span className="summary-count low">{totalSummary.low}</span>
                <span className="summary-label">Low</span>
              </div>
              <div className="summary-item">
                <span className="summary-count info">{totalSummary.informational}</span>
                <span className="summary-label">Info</span>
              </div>
              <div className="summary-item total">
                <span className="summary-count">{totalSummary.total}</span>
                <span className="summary-label">Total</span>
              </div>
            </div>

            <div className="report-selector">
              <span className="selector-label">Tool:</span>
              <select
                value={selectedReport}
                onChange={(e) => setSelectedReport(Number(e.target.value))}
                className="report-dropdown"
              >
                {reports.map((r, idx) => (
                  <option key={idx} value={idx}>
                    {r.tool} v{r.version} ({r.summary.total} issues)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {reports[selectedReport] && (
            <div className="report-details">
              <div className="report-status">
                <div className={`status-badge ${reports[selectedReport].passed ? 'passed' : 'failed'}`}>
                  {reports[selectedReport].passed ? '✅ PASSED' : '❌ FAILED'}
                </div>
                <span className="status-text">
                  {reports[selectedReport].passed ? 'No critical vulnerabilities found' : 'Critical vulnerabilities detected'}
                </span>
              </div>

              <div className="vulnerabilities-list">
                {reports[selectedReport].vulnerabilities.length === 0 ? (
                  <div className="no-vulnerabilities">
                    <div className="success-icon">🎉</div>
                    <h4>No vulnerabilities found!</h4>
                    <p>The contract passed all security checks for {reports[selectedReport].tool}.</p>
                  </div>
                ) : (
                  <div className="vulnerabilities-grid">
                    {reports[selectedReport].vulnerabilities.map((v, idx) => (
                      <div
                        key={idx}
                        className={`vulnerability-card ${v.severity === 'high' ? 'bg-red-900' : v.severity === 'medium' ? 'bg-yellow-900' : v.severity === 'low' ? 'bg-blue-900' : 'bg-gray-900'}`}
                        onClick={() => {
                          if (v.line_start && onVulnerabilityClick) onVulnerabilityClick(v.line_start)
                        }}
                      >
                        <div className="vulnerability-header">
                          <div className="severity-badge">
                            <span className={`security-badge ${v.severity}`}>
                              {v.severity.toUpperCase()}
                            </span>
                            {v.swc_id && <span className="swc-badge">{v.swc_id}</span>}
                          </div>
                          <div className="vulnerability-title">{v.title}</div>
                          {(v.line_start || v.line_end) && (
                            <div className="line-info">
                              Line{v.line_end && v.line_end !== v.line_start ? `s ${v.line_start}-${v.line_end}` : ` ${v.line_start}`}
                            </div>
                          )}
                        </div>

                        <div className="vulnerability-category">Category: {v.category}</div>
                        <div className="vulnerability-description">{v.description}</div>
                        <div className="vulnerability-recommendation">
                          <strong>Recommendation:</strong> {v.recommendation}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      ) : (
        !error && (
          <div className="analysis-placeholder">
            <div className="placeholder-icon">🔒</div>
            <h4>Security Analysis Ready</h4>
            <p>Run a security scan to detect vulnerabilities in your smart contract.</p>
          </div>
        )
      )}
    </div>
  )
}

