export interface Vulnerability {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  impact: string;
  confidence: 'high' | 'medium' | 'low';
  location: {
    file: string;
    line: number;
    column: number;
  };
  codeSnippet: string;
  remediation: string;
  references?: string[];
}

export interface SecurityReport {
  vulnerabilities: Vulnerability[];
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  score: number;
  timestamp: number;
  duration: number;
  toolsUsed: string[];
}

export interface CompilationError {
  severity: string;
  component: string;
  formatted_message: string;
  source_location?: {
    file: string;
    start: number;
    end: number;
  };
}

export interface CompilationWarning {
  message: string;
  line: number;
  column: number;
}

export interface CompilationResult {
  success: boolean;
  bytecode?: string;
  abi?: any;
  errors: CompilationError[];
  warnings: CompilationWarning[];
  contract_name?: string;
  compiler_version: string;
}

