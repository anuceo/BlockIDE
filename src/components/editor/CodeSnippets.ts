import type * as Monaco from 'monaco-editor';

export function registerCodeSnippets(monaco: typeof Monaco) {
  monaco.languages.registerCompletionItemProvider('solidity', {
    provideCompletionItems: (model, position) => {
      const word = model.getWordUntilPosition(position);
      const range: Monaco.IRange = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };

      const suggestions: Monaco.languages.CompletionItem[] = [
        {
          label: 'pragma solidity',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'pragma solidity ^0.8.19;\n\n',
          range,
        },
        {
          label: 'contract',
          kind: monaco.languages.CompletionItemKind.Class,
          insertText: [
            'contract ${1:MyContract} {',
            '  $0',
            '}',
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'function',
          kind: monaco.languages.CompletionItemKind.Method,
          insertText: [
            'function ${1:myFunction}(${2}) public ${3:returns (${4})} {',
            '  $0',
            '}',
          ].join('\n'),
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'require',
          kind: monaco.languages.CompletionItemKind.Function,
          insertText: 'require(${1:condition}, "${2:error message}");',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
        {
          label: 'emit',
          kind: monaco.languages.CompletionItemKind.Keyword,
          insertText: 'emit ${1:EventName}(${2});',
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
        },
      ];

      return { suggestions };
    },
  });
}

