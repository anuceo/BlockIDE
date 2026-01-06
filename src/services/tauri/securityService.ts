import { invoke } from '@tauri-apps/api/core';

export interface Vulnerability {
  id: string;
  severity: string;
  description: string;
  location: {
    file: string;
    line: number;
    column: number;
  };
  mitigation: string;
}

export interface SecurityReport {
  vulnerabilities: Vulnerability[];
  gas_estimates: {
    deployment: number;
    average_execution: number;
    max_execution: number;
  };
  storage_layout: {
    slots_used: number;
    variables: Array<{
      name: string;
      slot: number;
      size: number;
    }>;
  };
  timestamp: number;
}

export interface DiffAnalysis {
  added_vulnerabilities: Vulnerability[];
  fixed_vulnerabilities: Vulnerability[];
  gas_delta: number;
  storage_changes: Array<{
    variable: string;
    change: string;
  }>;
  overall_risk_change: string;
}

export class SecurityService {
  static async analyzeSecurity(code: string, contractId?: string): Promise<SecurityReport> {
    return await invoke<SecurityReport>('analyze_security', {
      code,
      contractId,
    });
  }

  static async compareVersions(oldCode: string, newCode: string, contractId: string): Promise<DiffAnalysis> {
    return await invoke<DiffAnalysis>('compare_versions', {
      oldCode,
      newCode,
      contractId,
    });
  }
}

