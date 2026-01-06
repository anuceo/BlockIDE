import { create } from 'zustand';

interface DebuggerState {
  gasData: unknown;
  transactionFlow: unknown[];
  callStack: unknown[];
  variables: Record<string, unknown>;

  setGasData: (gasData: unknown) => void;
  setTransactionFlow: (flow: unknown[]) => void;
  setCallStack: (stack: unknown[]) => void;
  setVariables: (vars: Record<string, unknown>) => void;
}

export const useDebuggerStore = create<DebuggerState>((set) => ({
  gasData: null,
  transactionFlow: [],
  callStack: [],
  variables: {},
  setGasData: (gasData) => set({ gasData }),
  setTransactionFlow: (transactionFlow) => set({ transactionFlow }),
  setCallStack: (callStack) => set({ callStack }),
  setVariables: (variables) => set({ variables }),
}));

