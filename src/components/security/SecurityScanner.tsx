import { useMemo, useState } from 'react';
import { SecurityAnalyzer, type SecurityReport, type Vulnerability } from '../../services/security/SecurityAnalyzer';

export function SecurityScanner({ code, contractName }: { code: string; contractName: string }) {
  const analyzer = useMemo(() => new SecurityAnalyzer(), []);
  const [report, setReport] = useState<SecurityReport | null>(null);
  const [selected, setSelected] = useState<Vulnerability | null>(null);
  const [status, setStatus] = useState<'idle' | 'scanning' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  return (
    <div style={{ padding: 12, height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Security</h2>
        <button
          disabled={status === 'scanning'}
          onClick={async () => {
            setStatus('scanning');
            setError(null);
            setSelected(null);
            try {
              const r = await analyzer.analyzeSolidity(code, contractName);
              setReport(r);
              setStatus('idle');
            } catch (e) {
              setStatus('error');
              setError(e instanceof Error ? e.message : 'Scan failed');
            }
          }}
        >
          {status === 'scanning' ? 'Scanning…' : 'Scan'}
        </button>
      </div>

      {error && <div style={{ color: '#ffb4b4', marginBottom: 10 }}>{error}</div>}

      {!report && <div style={{ opacity: 0.8 }}>Run a scan to see findings.</div>}

      {report && (
        <>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700 }}>Score: {report.score}/100</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>
              {report.vulnerabilities.length} findings • {report.duration}ms
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <h3 style={{ marginTop: 0 }}>Findings</h3>
              {report.vulnerabilities.length === 0 ? (
                <div>No issues found by built-in checks.</div>
              ) : (
                <ul style={{ paddingLeft: 18 }}>
                  {report.vulnerabilities.map((v) => (
                    <li key={v.id} style={{ marginBottom: 8 }}>
                      <button onClick={() => setSelected(v)} style={{ textAlign: 'left' }}>
                        [{v.severity}] {v.title}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 style={{ marginTop: 0 }}>Details</h3>
              {!selected ? (
                <div style={{ opacity: 0.8 }}>Select a finding to view details.</div>
              ) : (
                <div style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>
                    [{selected.severity}] {selected.title}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 8 }}>
                    {selected.location.file}:{selected.location.line}
                  </div>
                  <div style={{ marginBottom: 8 }}>{selected.description}</div>
                  <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 8 }}>
                    <strong>Remediation:</strong> {selected.remediation}
                  </div>
                  <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap' }}>{selected.codeSnippet}</pre>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

