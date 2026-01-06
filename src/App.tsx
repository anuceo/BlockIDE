import { useEffect } from 'react';
import { useEditorStore } from '@stores/editorStore';
import { SmartContractEditor } from '@components/editor/SmartContractEditor';

export default function App() {
  const initializeWorkspace = useEditorStore((s) => s.initializeWorkspace);
  const currentFile = useEditorStore((s) => s.currentFile);
  const files = useEditorStore((s) => s.files);
  const setCurrentFile = useEditorStore((s) => s.setCurrentFile);
  const code = useEditorStore((s) => s.code);
  const setCode = useEditorStore((s) => s.setCode);
  const saveFile = useEditorStore((s) => s.saveFile);

  useEffect(() => {
    void initializeWorkspace();
  }, [initializeWorkspace]);

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-title">Workspace</div>
        <div className="file-list">
          {Object.keys(files).map((fp) => (
            <button
              key={fp}
              className={`file ${fp === currentFile ? 'active' : ''}`}
              onClick={() => setCurrentFile(fp)}
              type="button"
            >
              {fp}
            </button>
          ))}
        </div>
        <button className="btn" onClick={() => void saveFile()} type="button">
          Save
        </button>
      </aside>
      <main className="main">
        <div className="toolbar">
          <div className="current-file">{currentFile ?? 'No file'}</div>
        </div>
        <SmartContractEditor code={code} onChange={setCode} />
      </main>
    </div>
  );
}

