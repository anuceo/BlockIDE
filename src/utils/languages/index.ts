import type * as Monaco from 'monaco-editor';
import { registerSolidity } from './solidity';

export function setupLanguageSupport(monaco: typeof Monaco) {
  registerSolidity(monaco);
}

