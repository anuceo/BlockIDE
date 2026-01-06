import { invoke } from '@tauri-apps/api/core';

export interface ContractDeployment {
  address: string;
  bytecode: string;
  gas_used: number;
  transaction_hash: string;
}

export interface ContractExecution {
  result: string;
  gas_used: number;
  logs: string[];
}

export interface GasEstimation {
  slow: number;
  standard: number;
  fast: number;
  max_fee_per_gas: number;
  max_priority_fee_per_gas: number;
}

export class EVMService {
  static async deployContract(bytecode: string, value?: string, gasLimit?: number): Promise<ContractDeployment> {
    return await invoke<ContractDeployment>('deploy_contract', {
      bytecode,
      value,
      gasLimit,
    });
  }

  static async executeContract(
    contractAddress: string,
    calldata: string,
    value?: string,
    gasLimit?: number,
  ): Promise<ContractExecution> {
    return await invoke<ContractExecution>('execute_contract', {
      contractAddress,
      calldata,
      value,
      gasLimit,
    });
  }

  static async estimateGas(bytecode: string, calldata?: string): Promise<GasEstimation> {
    return await invoke<GasEstimation>('estimate_gas', {
      bytecode,
      calldata,
    });
  }

  static async compileSolidity(source: string): Promise<unknown> {
    return await invoke('compile_solidity', { source });
  }
}

