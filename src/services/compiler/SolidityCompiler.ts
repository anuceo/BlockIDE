import { invoke } from '@tauri-apps/api/core'

export interface CompiledContract {
  abi: any[]
  bin: string
  metadata?: string
}

export interface CompilationResult {
  success: boolean
  contracts: Record<string, CompiledContract>
  errors: string[]
  warnings: string[]
  compilerVersion: string
}

type BackendContract = {
  name: string
  abi: any
  bin: string
  metadata?: string | null
}

type BackendResult = {
  solc_version?: string | null
  contracts: BackendContract[]
  warnings: string[]
}

export class SolidityCompiler {
  static async compile(code: string, optimize: boolean = true, version: string = '0.8.19'): Promise<CompilationResult> {
    try {
      const result = await invoke<BackendResult>('compile_solidity_real', {
        code,
        version,
        optimize,
      })

      const contracts: Record<string, CompiledContract> = {}
      for (const c of result.contracts ?? []) {
        contracts[c.name] = {
          abi: Array.isArray(c.abi) ? c.abi : [],
          bin: c.bin ?? '',
          metadata: c.metadata ?? undefined,
        }
      }

      return {
        success: true,
        contracts,
        errors: [],
        warnings: result.warnings ?? [],
        compilerVersion: result.solc_version ?? version,
      }
    } catch (error: any) {
      console.error('Compilation failed:', error)
      return {
        success: false,
        contracts: {},
        errors: [String(error)],
        warnings: [],
        compilerVersion: version,
      }
    }
  }
}

