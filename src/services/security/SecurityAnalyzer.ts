export interface Vulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  impact: string;
  confidence: 'high' | 'medium' | 'low';
  location: { file: string; line: number; column: number };
  codeSnippet: string;
  remediation: string;
  references?: string[];
}

export interface SecurityReport {
  vulnerabilities: Vulnerability[];
  summary: { critical: number; high: number; medium: number; low: number; info: number };
  score: number;
  timestamp: number;
  duration: number;
  toolsUsed: string[];
}

export class SecurityAnalyzer {
  async analyzeSolidity(code: string, contractName: string): Promise<SecurityReport> {
    const start = Date.now();
    const vulnerabilities: Vulnerability[] = [];

    vulnerabilities.push(...this.checkReentrancy(code, contractName));
    vulnerabilities.push(...this.checkTxOrigin(code, contractName));

    const summary = this.calculateSummary(vulnerabilities);
    const score = this.calculateSecurityScore(summary);

    return {
      vulnerabilities,
      summary,
      score,
      timestamp: Date.now(),
      duration: Date.now() - start,
      toolsUsed: ['built-in'],
    };
  }

  private checkReentrancy(code: string, contractName: string): Vulnerability[] {
    const vulns: Vulnerability[] = [];
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('.call{value:') || line.includes('.call(')) {
        // crude heuristic: state write after external call within next few lines
        for (let j = i + 1; j < Math.min(i + 12, lines.length); j++) {
          const next = lines[j];
          if (next.includes('=') && !next.trim().startsWith('//')) {
            vulns.push({
              id: `reentrancy-${i}`,
              severity: 'high',
              title: 'Possible reentrancy',
              description: 'External call followed by a potential state change.',
              impact: 'May allow reentrancy attacks.',
              confidence: 'medium',
              location: { file: `${contractName}.sol`, line: i + 1, column: 1 },
              codeSnippet: line.trim(),
              remediation: 'Use Checks-Effects-Interactions pattern and consider ReentrancyGuard.',
              references: ['https://swcregistry.io/docs/SWC-107'],
            });
            break;
          }
        }
      }
    }
    return vulns;
  }

  private checkTxOrigin(code: string, contractName: string): Vulnerability[] {
    const vulns: Vulnerability[] = [];
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('tx.origin')) {
        vulns.push({
          id: `tx-origin-${i}`,
          severity: 'medium',
          title: 'Use of tx.origin',
          description: 'tx.origin used for authorization can enable phishing-style attacks.',
          impact: 'Authorization bypass risk.',
          confidence: 'high',
          location: { file: `${contractName}.sol`, line: i + 1, column: 1 },
          codeSnippet: line.trim(),
          remediation: 'Use msg.sender for authorization checks.',
          references: ['https://swcregistry.io/docs/SWC-115'],
        });
      }
    }
    return vulns;
  }

  private calculateSummary(vulnerabilities: Vulnerability[]): SecurityReport['summary'] {
    const summary = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (const v of vulnerabilities) summary[v.severity]++;
    return summary;
  }

  private calculateSecurityScore(summary: SecurityReport['summary']): number {
    const penalties = summary.critical * 30 + summary.high * 15 + summary.medium * 7 + summary.low * 3 + summary.info * 1;
    return Math.max(0, 100 - penalties);
  }
}

