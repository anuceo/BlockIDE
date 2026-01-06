type Monaco = typeof import('monaco-editor');

export function registerSolidity(monaco: Monaco) {
  monaco.languages.register({ id: 'solidity' });

  monaco.languages.setMonarchTokensProvider('solidity', {
    keywords: [
      'contract',
      'function',
      'returns',
      'public',
      'private',
      'internal',
      'external',
      'view',
      'pure',
      'payable',
      'event',
      'emit',
      'modifier',
      'struct',
      'enum',
      'mapping',
      'pragma',
      'import',
      'library',
      'interface',
      'error',
    ],
    typeKeywords: ['uint', 'uint256', 'int', 'int256', 'address', 'bool', 'bytes', 'string'],
    tokenizer: {
      root: [
        [/\/\*/, 'comment', '@comment'],
        [/\/\/.*$/, 'comment'],
        [/"([^"\\]|\\.)*$/, 'string.invalid'],
        [/"/, 'string', '@string'],
        [/\b([0-9]+)\b/, 'number'],
        [/\b0x[0-9a-fA-F]+\b/, 'number.hex'],
        [/[{}()[\]]/, '@brackets'],
        [/[;,.]/, 'delimiter'],
        [/[=><!~?:&|+\-*/^%]+/, 'operator'],
        [
          /\b[a-zA-Z_]\w*\b/,
          {
            cases: {
              '@keywords': 'keyword',
              '@typeKeywords': 'type',
              '@default': 'identifier',
            },
          },
        ],
        [/[ \t\r\n]+/, 'white'],
      ],
      comment: [
        [/[^\/*]+/, 'comment'],
        [/\*\//, 'comment', '@pop'],
        [/[\/*]/, 'comment'],
      ],
      string: [
        [/[^\\"]+/, 'string'],
        [/\\./, 'string.escape'],
        [/"/, 'string', '@pop'],
      ],
    },
  });
}

