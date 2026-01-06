import React, { useMemo, useRef, useState } from 'react';
import MonacoEditor, { type BeforeMount, type OnMount } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { useEditorStore, type EditorLanguage } from '../../stores/editorStore';
import { setupLanguageSupport } from './LanguageSupport';
import { registerCodeSnippets } from './CodeSnippets';
import { defineBlockchainThemes } from './MonacoSetup';
import './SmartContractEditor.css';

export interface SmartContractEditorProps {
  onCompile?: (code: string) => void;
  onDeploy?: (code: string) => void;
  onAnalyze?: (code: string) => void;
}

function getLanguageTemplate(lang: EditorLanguage): string {
  const templates: Record<EditorLanguage, string> = {
    solidity: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract HelloWorld {
  string public greeting = "Hello, World!";

  function setGreeting(string memory _greeting) public {
    greeting = _greeting;
  }

  function getGreeting() public view returns (string memory) {
    return greeting;
  }
}
`,
    rust: `use solana_program::{
  account_info::AccountInfo,
  entrypoint,
  entrypoint::ProgramResult,
  msg,
  pubkey::Pubkey,
};

entrypoint!(process_instruction);

pub fn process_instruction(
  _program_id: &Pubkey,
  _accounts: &[AccountInfo],
  _instruction_data: &[u8],
) -> ProgramResult {
  msg!("Hello, Solana!");
  Ok(())
}
`,
    move: `module 0x1::HelloWorld {
  use std::signer;

  struct HelloWorld has key, store {
    greeting: vector<u8>,
  }

  public entry fun set_greeting(account: &signer, greeting: vector<u8>) {
    let hello_world = HelloWorld { greeting };
    move_to(account, hello_world);
  }
}
`,
    cairo: `%lang starknet

@storage_var
func greeting() -> (res: felt) {
}

@external
func set_greeting{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}(_greeting: felt) {
  greeting.write(_greeting);
  return ();
}

@view
func get_greeting{syscall_ptr: felt*, pedersen_ptr: HashBuiltin*, range_check_ptr}() -> (res: felt) {
  let (res) = greeting.read();
  return (res,);
}
`,
    typescript: `export function hello(name: string) {
  return \`hello \${name}\`;
}
`,
    javascript: `export function hello(name) {
  return \`hello \${name}\`;
}
`,
  };
  return templates[lang];
}

export function SmartContractEditor({ onCompile, onDeploy, onAnalyze }: SmartContractEditorProps) {
  const {
    code,
    language,
    theme,
    fontSize,
    wordWrap,
    minimap,
    lineNumbers,
    setCode,
    setLanguage,
    setTheme,
  } = useEditorStore();

  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const [isEditorReady, setIsEditorReady] = useState(false);

  const beforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;
    setupLanguageSupport(monaco);
    defineBlockchainThemes(monaco);
    registerCodeSnippets(monaco);
  };

  const onMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    setIsEditorReady(true);
  };

  const validateSolidity = useMemo(() => {
    return (value: string) => {
      const monaco = monacoRef.current;
      const editor = editorRef.current;
      if (!monaco || !editor) return;
      const model = editor.getModel();
      if (!model) return;

      const markers: Monaco.editor.IMarkerData[] = [];
      if (!value.includes('pragma solidity')) {
        markers.push({
          severity: monaco.MarkerSeverity.Warning,
          message: 'Missing pragma solidity directive',
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: 1,
          endColumn: 1,
        });
      }

      monaco.editor.setModelMarkers(model, 'blockchain-ide', markers);
    };
  }, []);

  const handleLanguageChange = (newLanguage: EditorLanguage) => {
    setLanguage(newLanguage);
    // If user is on the default template, swap templates to match language.
    if (code.trim().length === 0) {
      setCode(getLanguageTemplate(newLanguage));
    }
  };

  return (
    <div className="smart-contract-editor">
      <div className="editor-toolbar">
        <select
          value={language}
          onChange={(e) => handleLanguageChange(e.target.value as EditorLanguage)}
          className="language-selector"
        >
          <option value="solidity">Solidity (EVM)</option>
          <option value="rust">Rust (Solana)</option>
          <option value="move">Move (Aptos/Sui)</option>
          <option value="cairo">Cairo (StarkNet)</option>
          <option value="typescript">TypeScript</option>
          <option value="javascript">JavaScript</option>
        </select>

        <div className="toolbar-actions">
          <button onClick={() => onCompile?.(code)} className="btn btn-compile" title="Compile">
            Compile
          </button>
          <button onClick={() => onDeploy?.(code)} className="btn btn-deploy" title="Deploy">
            Deploy
          </button>
          <button onClick={() => onAnalyze?.(code)} className="btn btn-analyze" title="Analyze">
            Analyze
          </button>
          <button
            onClick={() => setTheme(theme === 'blockchain-dark' ? 'blockchain-light' : 'blockchain-dark')}
            className="btn btn-theme"
            title="Toggle theme"
          >
            {theme === 'blockchain-dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>

      <div className="editor-container">
        {!isEditorReady && <div className="editor-loading">Loading editor…</div>}
        <MonacoEditor
          height="100%"
          language={language}
          value={code}
          onChange={(value) => {
            const next = value ?? '';
            setCode(next);
            if (language === 'solidity') validateSolidity(next);
          }}
          theme={theme}
          beforeMount={beforeMount}
          onMount={onMount}
          options={{
            minimap: { enabled: minimap },
            fontSize,
            wordWrap: wordWrap ? 'on' : 'off',
            tabSize: 2,
            insertSpaces: true,
            automaticLayout: true,
            scrollBeyondLastLine: false,
            folding: true,
            lineNumbers: lineNumbers ? 'on' : 'off',
            renderLineHighlight: 'all',
          }}
        />
      </div>
    </div>
  );
}

