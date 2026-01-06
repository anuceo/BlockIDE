import React, { useState } from 'react';
import { SecurityAnalyzer } from '../../services/security/SecurityAnalyzer';
import { useEditorStore } from '../../stores/editorStore';

export const SecurityScanner: React.FC = () => {
  const { code } = useEditorStore();
  const [scanning, setScanning] = useState(false);
  const [report, setReport] = useState<any>(null);

  const handleScan = async () => {
    setScanning(true);
    try {
      const result = await SecurityAnalyzer.analyzeSolidity(code, 'Contract');
      setReport(result);
    } catch (error) {
      console.error('Security scan failed:', error);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="security-scanner">
      <div className="scanner-header">
        <h3>Security Scanner</h3>
        <button className="btn btn-scan" onClick={() => void handleScan()} disabled={scanning} type="button">
          {scanning ? 'Scanning...' : '🔍 Scan Contract'}
        </button>
      </div>

      {report && (
        <div className="scan-results">
          <h4>Security Score: {report.score}/100</h4>
          <div className="vulnerabilities">
            {report.vulnerabilities.map((vuln: any, index: number) => (
              <div key={index} className="vulnerability">
                <strong>{vuln.title}</strong> ({vuln.severity})
                <p>{vuln.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

