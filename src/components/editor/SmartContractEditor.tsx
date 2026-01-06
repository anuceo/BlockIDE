import MonacoEditor, { type OnMount } from '@monaco-editor/react';
import { useEditorStore } from '../../stores/editorStore';
import { setupLanguageSupport } from '../../utils/languages';

export function SmartContractEditor() {
  const { code, language, setCode } = useEditorStore();

  const handleEditorMount: OnMount = (_editor, monaco) => {
    setupLanguageSupport(monaco);
  };

  return (
    <MonacoEditor
      height="100vh"
      language={language}
      value={code}
      onChange={(value) => setCode(value ?? '')}
      onMount={handleEditorMount}
      theme="vs-dark"
      options={{
        minimap: { enabled: true },
        scrollBeyondLastLine: false,
        fontSize: 14,
        wordWrap: 'on',
        automaticLayout: true,
        tabSize: 2,
      }}
    />
  );
}

