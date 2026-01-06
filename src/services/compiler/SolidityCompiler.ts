import { invoke } from '@tauri-apps/api/core';
import type { CompilationError, CompilationResult } from '../../types/security';

export class SolidityCompiler {
  static async compile(code: string, version = '0.8.19'): Promise<CompilationResult> {
    try {
      const result = await invoke<CompilationResult>('compile_solidity', {
        code,
        version,
      });
      return result;
    } catch (error: any) {
      console.error('Compilation failed:', error);
      return {
        success: false,
        errors: [
          {
            severity: 'error',
            component: 'compiler',
            formatted_message: error?.message || 'Unknown compilation error',
          },
        ],
        warnings: [],
        compiler_version: version,
      };
    }
  }

  static async validate(code: string): Promise<CompilationError[]> {
    try {
      return await invoke<CompilationError[]>('validate_solidity', { code });
    } catch (error) {
      console.error('Validation failed:', error);
      return [];
    }
  }
}

