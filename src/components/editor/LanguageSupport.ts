import type * as Monaco from 'monaco-editor';

// Minimal multi-language registration. Tokenizers are intentionally lightweight
// for MVP; we can iterate into full monarch grammars later.
export function setupLanguageSupport(monaco: typeof Monaco) {
  const languages = ['solidity', 'rust', 'move', 'cairo', 'typescript', 'javascript'] as const;
  for (const id of languages) {
    monaco.languages.register({ id });
  }
}

