import { invoke } from '@tauri-apps/api/core';
import type { SecurityReport, Vulnerability } from '../../types/security';

export class SecurityAnalyzer {
  static async analyzeSolidity(code: string, contractName: string): Promise<SecurityReport> {
    const vulnerabilities: Vulnerability[] = [];

    vulnerabilities.push(...(await this.checkReentrancy(code, contractName)));
    vulnerabilities.push(...(await this.checkIntegerOverflow(code, contractName)));
    vulnerabilities.push(...(await this.checkAccessControl(code, contractName)));
    vulnerabilities.push(...(await this.checkUncheckedCalls(code, contractName)));

    try {
      const slitherResult = await invoke<string>('run_slither', {
        code,
        contractName,
      });
      vulnerabilities.push(...this.parseSlitherOutput(slitherResult));
    } catch (error) {
      console.warn('Slither analysis failed:', error);
    }

    const summary = this.calculateSummary(vulnerabilities);
    const score = this.calculateSecurityScore(summary);

    return {
      vulnerabilities,
      summary,
      score,
      timestamp: Date.now(),
      duration: 0,
      toolsUsed: ['built-in', 'slither'],
    };
  }

  private static async checkReentrancy(code: string, contractName: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('.call') || line.includes('.send') || line.includes('.transfer')) {
        for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
          if (lines[j].includes('=') && !lines[j].trim().startsWith('//')) {
            vulnerabilities.push({
              id: `reentrancy-${i}`,
              severity: 'high',
              title: 'Possible Reentrancy',
              description: 'External call followed by state changes',
              impact: 'Could allow reentrancy attacks',
              confidence: 'medium',
              location: { file: `${contractName}.sol`, line: i + 1, column: 1 },
              codeSnippet: line,
              remediation: 'Use Checks-Effects-Interactions pattern. Consider ReentrancyGuard.',
              references: ['https://swcregistry.io/docs/SWC-107'],
            });
            break;
          }
        }
      }
    }

    return vulnerabilities;
  }

  private static async checkIntegerOverflow(code: string, contractName: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('+') || line.includes('-') || line.includes('*') || line.includes('/')) {
        if (!line.includes('SafeMath') && !line.includes('unchecked')) {
          vulnerabilities.push({
            id: `integer-overflow-${i}`,
            severity: 'high',
            title: 'Integer Overflow/Underflow',
            description: 'Arithmetic operation without overflow protection',
            impact: 'Could lead to incorrect calculations or exploits',
            confidence: 'medium',
            location: { file: `${contractName}.sol`, line: i + 1, column: 1 },
            codeSnippet: line,
            remediation: 'Use Solidity 0.8+ checked arithmetic; avoid unchecked blocks.',
            references: ['https://swcregistry.io/docs/SWC-101'],
          });
        }
      }
    }

    return vulnerabilities;
  }

  private static async checkAccessControl(code: string, contractName: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.includes('tx.origin')) {
        vulnerabilities.push({
          id: `tx-origin-${i}`,
          severity: 'medium',
          title: 'Use of tx.origin',
          description: 'tx.origin used for authorization',
          impact: 'Vulnerable to phishing attacks',
          confidence: 'high',
          location: { file: `${contractName}.sol`, line: i + 1, column: 1 },
          codeSnippet: line,
          remediation: 'Use msg.sender instead of tx.origin for authorization',
          references: ['https://swcregistry.io/docs/SWC-115'],
        });
      }
    }

    return vulnerabilities;
  }

  private static async checkUncheckedCalls(code: string, contractName: string): Promise<Vulnerability[]> {
    const vulnerabilities: Vulnerability[] = [];
    const lines = code.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (
        (line.includes('.call') || line.includes('.send') || line.includes('.transfer')) &&
        !line.includes('require') &&
        !line.includes('if') &&
        !line.includes('revert')
      ) {
        vulnerabilities.push({
          id: `unchecked-call-${i}`,
          severity: 'medium',
          title: 'Unchecked External Call',
          description: 'External call without checking return value',
          impact: 'Could silently fail',
          confidence: 'high',
          location: { file: `${contractName}.sol`, line: i + 1, column: 1 },
          codeSnippet: line,
          remediation: 'Always check return values for low-level calls',
          references: ['https://swcregistry.io/docs/SWC-104'],
        });
      }
    }

    return vulnerabilities;
  }

  private static parseSlitherOutput(output: string): Vulnerability[] {
    const vulnerabilities: Vulnerability[] = [];

    try {
      const data = JSON.parse(output);
      if (data.results?.detectors) {
        data.results.detectors.forEach((detector: any) => {
          vulnerabilities.push({
            id: `slither-${detector.check}`,
            severity: this.mapSlitherSeverity(detector.impact),
            title: detector.check,
            description: detector.description,
            impact: detector.impact,
            confidence: (detector.confidence as any) ?? 'low',
            location: {
              file: detector.elements?.[0]?.source_mapping?.filename || 'unknown',
              line: detector.elements?.[0]?.source_mapping?.lines?.[0] || 1,
              column: 1,
            },
            codeSnippet: detector.markdown || '',
            remediation: detector.exploit_scenario || '',
            references: detector.reference || [],
          });
        });
      }
    } catch (error) {
      console.error('Failed to parse slither output:', error);
    }

    return vulnerabilities;
  }

  private static mapSlitherSeverity(impact: string): Vulnerability['severity'] {
    const map: Record<string, Vulnerability['severity']> = {
      High: 'high',
      Medium: 'medium',
      Low: 'low',
      Informational: 'info',
    };
    return map[impact] || 'info';
  }

  private static calculateSummary(vulnerabilities: Vulnerability[]): SecurityReport['summary'] {
    const summary: SecurityReport['summary'] = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    vulnerabilities.forEach((v) => {
      summary[v.severity] += 1;
    });
    return summary;
  }

  private static calculateSecurityScore(summary: SecurityReport['summary']): number {
    const weights = { critical: 20, high: 10, medium: 5, low: 2, info: 1 } as const;
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    const penalty =
      (summary.critical * weights.critical +
        summary.high * weights.high +
        summary.medium * weights.medium +
        summary.low * weights.low +
        summary.info * weights.info) /
      totalWeight;
    const score = 100 - penalty * 100;
    return Math.max(0, Math.min(100, score));
  }
}

