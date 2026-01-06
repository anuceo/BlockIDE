import React, { useRef, useState } from 'react';
import MonacoEditor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import { useEditorStore } from '../../stores/editorStore';
import { SolidityCompiler } from '../../services/compiler/SolidityCompiler';
import './SmartContractEditor.css';

export const SmartContractEditor: React.FC = () => {
  const { code, language, theme, fontSize, wordWrap, minimap, setCode, setLanguage, setTheme } = useEditorStore();

  const editorRef = useRef<any>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationResult, setCompilationResult] = useState<any>(null);
  const [errors, setErrors] = useState<any[]>([]);

  const handleEditorWillMount: BeforeMount = (monaco) => {
    monaco.editor.defineTheme('blockchain-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6A9955' },
        { token: 'keyword', foreground: '569CD6' },
        { token: 'function', foreground: 'DCDCAA' },
        { token: 'variable', foreground: '9CDCFE' },
        { token: 'string', foreground: 'CE9178' },
        { token: 'number', foreground: 'B5CEA8' },
      ],
      colors: {
        'editor.background': '#1E1E1E',
        'editor.foreground': '#D4D4D4',
        'editor.lineHighlightBackground': '#2A2D2E',
      },
    });

    monaco.editor.defineTheme('blockchain-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '008000' },
        { token: 'keyword', foreground: '0000FF' },
        { token: 'function', foreground: '795E26' },
        { token: 'variable', foreground: '001080' },
        { token: 'string', foreground: 'A31515' },
        { token: 'number', foreground: '098658' },
      ],
      colors: {
        'editor.background': '#FFFFFF',
        'editor.foreground': '#000000',
        'editor.lineHighlightBackground': '#ADD6FF26',
      },
    });

    monaco.languages.register({ id: 'solidity' });
    monaco.languages.setMonarchTokensProvider('solidity', {
      defaultToken: 'invalid',
      tokenPostfix: '.sol',
      keywords: [
        'pragma',
        'solidity',
        'contract',
        'interface',
        'library',
        'is',
        'function',
        'returns',
        'modifier',
        'event',
        'struct',
        'enum',
        'public',
        'private',
        'internal',
        'external',
        'payable',
        'view',
        'pure',
        'constant',
        'immutable',
        'override',
        'virtual',
      ],
      typeKeywords: [
        'address',
        'bool',
        'string',
        'bytes',
        'byte',
        'uint',
        'int',
        'uint8',
        'int8',
        'uint16',
        'int16',
        'uint32',
        'int32',
        'uint64',
        'int64',
        'uint128',
        'int128',
        'uint256',
        'int256',
      ],
      operators: [
        '=',
        '>',
        '<',
        '!',
        '~',
        '?',
        ':',
        '==',
        '<=',
        '>=',
        '!=',
        '&&',
        '||',
        '++',
        '--',
        '+',
        '-',
        '*',
        '/',
        '%',
        '&',
        '|',
        '^',
        '<<',
        '>>',
        '>>>',
        '+=',
        '-=',
        '*=',
        '/=',
        '%=',
        '&=',
        '|=',
        '^=',
        '<<=',
        '>>=',
        '>>>=',
      ],
      symbols: /[=><!~?:&|+\-*/^%]+/,
      tokenizer: {
        root: [
          [
            /[a-zA-Z_]\w*/,
            {
              cases: {
                '@keywords': 'keyword',
                '@typeKeywords': 'type',
                '@default': 'identifier',
              },
            },
          ],
          { include: '@whitespace' },
          { include: '@numbers' },
          { include: '@strings' },
          { include: '@comments' },
          [/[\\]{}()[[]/, '@brackets'],
          [
            /@symbols/,
            {
              cases: {
                '@operators': 'operator',
                '@default': '',
              },
            },
          ],
        ],
        whitespace: [[/\s+/, 'white']],
        numbers: [[/\d+/, 'number']],
        strings: [[/["']/, { token: 'string.quote', bracket: '@open', next: '@string' }]],
        string: [
          [/[^"'\\$]+/, 'string'],
          [/\\./, 'string.escape.invalid'],
          [/["']/, { token: 'string.quote', bracket: '@close', next: '@pop' }],
        ],
        comments: [
          [/\/\/.*$/, 'comment'],
          [/\/\*/, { token: 'comment.quote', next: '@comment' }],
        ],
        comment: [
          [/[^*/]+/, 'comment'],
          [/\*\//, { token: 'comment.quote', next: '@pop' }],
          [/./, 'comment'],
        ],
      },
    });
  };

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    editor.onDidChangeModelContent(async () => {
      const nextCode = editor.getValue();
      const validationErrors = await SolidityCompiler.validate(nextCode);
      setErrors(validationErrors);

      const markers = validationErrors.map((error) => ({
        severity: error.severity === 'error' ? 8 : 4,
        message: error.formatted_message,
        startLineNumber: error.source_location?.start || 1,
        startColumn: 1,
        endLineNumber: error.source_location?.end || 1,
        endColumn: 100,
      }));

      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelMarkers(model, 'validator', markers);
      }
    });
  };

  const handleCompile = async () => {
    setIsCompiling(true);
    try {
      const result = await SolidityCompiler.compile(code);
      setCompilationResult(result);
    } catch (error) {
      console.error('Compilation error:', error);
    } finally {
      setIsCompiling(false);
    }
  };

  const handleDeploy = () => {
    if (!compilationResult?.success) {
      alert('Please compile the contract first');
      return;
    }
    console.log('Deploying contract...', compilationResult);
  };

  const handleSecurityScan = () => {
    console.log('Running security scan...');
  };

  const handleLanguageChange = (newLanguage: string) => {
    setLanguage(newLanguage);
    if (code.trim() === '') {
      const template = getLanguageTemplate(newLanguage);
      if (template) setCode(template);
    }
  };

  const getLanguageTemplate = (lang: string): string => {
    const templates: Record<string, string> = {
      solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract HelloWorld {
    string public greeting = "Hello, World!";
    
    function setGreeting(string memory _greeting) public {
        greeting = _greeting;
    }
    
    function getGreeting() public view returns (string memory) {
        return greeting;
    }
}`,
      rust: `use solana_program::{
    account_info::AccountInfo,
    entrypoint,
    entrypoint::ProgramResult,
    msg,
    pubkey::Pubkey,
};

entrypoint!(process_instruction);

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    msg!("Hello, Solana!");
    Ok(())
}`,
      typescript: `import { ethers } from 'ethers';

async function main() {
    console.log('Blockchain IDE Development');
}

main().catch(console.error);`,
    };
    return templates[lang] || '';
  };

  return (
    <div className="smart-contract-editor">
      <div className="editor-toolbar">
        <select value={language} onChange={(e) => handleLanguageChange(e.target.value)} className="language-selector">
          <option value="solidity">Solidity (EVM)</option>
          <option value="rust">Rust (Solana)</option>
          <option value="typescript">TypeScript</option>
          <option value="javascript">JavaScript</option>
        </select>

        <div className="toolbar-actions">
          <button onClick={handleCompile} className="btn btn-compile" disabled={isCompiling} type="button">
            {isCompiling ? '🔄 Compiling...' : '🛠️ Compile'}
          </button>
          <button onClick={handleDeploy} className="btn btn-deploy" disabled={!compilationResult?.success} type="button">
            🚀 Deploy
          </button>
          <button onClick={handleSecurityScan} className="btn btn-analyze" type="button">
            🔍 Security Scan
          </button>
          <button
            onClick={() => setTheme(theme === 'blockchain-dark' ? 'blockchain-light' : 'blockchain-dark')}
            className="btn btn-theme"
            type="button"
          >
            {theme === 'blockchain-dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </div>

      <div className="editor-container">
        <MonacoEditor
          height="100%"
          language={language}
          value={code}
          onChange={(value) => setCode(value || '')}
          theme={theme}
          beforeMount={handleEditorWillMount}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: minimap },
            fontSize,
            wordWrap: wordWrap ? 'on' : 'off',
            tabSize: 2,
            insertSpaces: true,
            automaticLayout: true,
            formatOnPaste: true,
            formatOnType: true,
            scrollBeyondLastLine: false,
            folding: true,
            lineNumbers: 'on',
            renderLineHighlight: 'all',
            scrollbar: { vertical: 'visible', horizontal: 'visible' },
            suggestOnTriggerCharacters: true,
            acceptSuggestionOnEnter: 'on',
          }}
        />
      </div>

      {(errors.length > 0 || compilationResult) && (
        <div className="editor-footer">
          {errors.length > 0 && (
            <div className="validation-errors">
              <h4>Validation Issues ({errors.length})</h4>
              {errors.map((error, index) => (
                <div key={index} className={`error-item ${error.severity}`}>
                  [{String(error.severity).toUpperCase()}] {error.formatted_message}
                </div>
              ))}
            </div>
          )}

          {compilationResult && (
            <div className="compilation-result">
              <h4>Compilation Result</h4>
              <div className={`result-status ${compilationResult.success ? 'success' : 'error'}`}>
                {compilationResult.success ? '✅ Success' : '❌ Failed'}
                {compilationResult.contract_name && ` - ${compilationResult.contract_name}`}
              </div>
              {compilationResult.errors?.map((error: any, index: number) => (
                <div key={index} className="compilation-error">
                  {error.formatted_message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

