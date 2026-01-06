import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SmartContractEditor } from './components/editor/SmartContractEditor';
import { WalletConnector } from './components/blockchain/WalletConnector';
import { NetworkSelector } from './components/blockchain/NetworkSelector';
import { DebuggerPanel } from './components/debugger/DebuggerPanel';
import { SecurityScanner } from './components/security/SecurityScanner';
import { IPFSBrowser } from './components/ipfs/IPFSBrowser';
import { TemplateGallery } from './components/templates/TemplateGallery';
import { PluginManager } from './components/plugins/PluginManager';
import { useEditorStore } from './stores/editorStore';
import { EVMService } from './services/tauri/evmService';
import './App.css';

export default function App() {
  const [tauriStatus, setTauriStatus] = useState<string>('Tauri: not connected (web mode)');
  const [activePanel, setActivePanel] = useState<'editor' | 'debugger' | 'security' | 'ipfs' | 'templates' | 'plugins'>(
    'editor',
  );
  const [compilationResult, setCompilationResult] = useState<unknown>(null);
  const [showSidebar, setShowSidebar] = useState(true);

  const { code, language } = useEditorStore();

  useEffect(() => {
    // In web mode, this will typically fail (no Tauri runtime).
    invoke<string>('greet', { name: 'developer' })
      .then((msg) => setTauriStatus(msg))
      .catch(() => setTauriStatus('Tauri: not connected (web mode)'));
  }, []);

  const handleCompile = async () => {
    const result = await EVMService.compileSolidity(code);
    setCompilationResult(result);
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="app-title">Blockchain IDE</div>
          <div className="app-subtitle">{tauriStatus}</div>
        </div>
        <div className="header-right">
          <NetworkSelector />
          <WalletConnector />
        </div>
      </header>

      <div className="app-main">
        {showSidebar && (
          <aside className="app-sidebar">
            <div className="sidebar-header">
              <h3>Workspace</h3>
              <button className="sidebar-toggle" onClick={() => setShowSidebar(false)}>
                ◀
              </button>
            </div>

            <div className="sidebar-panels">
              <button className={`sidebar-btn ${activePanel === 'editor' ? 'active' : ''}`} onClick={() => setActivePanel('editor')}>
                Editor
              </button>
              <button
                className={`sidebar-btn ${activePanel === 'debugger' ? 'active' : ''}`}
                onClick={() => setActivePanel('debugger')}
              >
                Debugger
              </button>
              <button
                className={`sidebar-btn ${activePanel === 'security' ? 'active' : ''}`}
                onClick={() => setActivePanel('security')}
              >
                Security
              </button>
              <button className={`sidebar-btn ${activePanel === 'ipfs' ? 'active' : ''}`} onClick={() => setActivePanel('ipfs')}>
                IPFS
              </button>
              <button
                className={`sidebar-btn ${activePanel === 'templates' ? 'active' : ''}`}
                onClick={() => setActivePanel('templates')}
              >
                Templates
              </button>
              <button
                className={`sidebar-btn ${activePanel === 'plugins' ? 'active' : ''}`}
                onClick={() => setActivePanel('plugins')}
              >
                Plugins
              </button>
            </div>
          </aside>
        )}

        <main className="app-content">
          {!showSidebar && (
            <button className="sidebar-toggle-open" onClick={() => setShowSidebar(true)}>
              ▶
            </button>
          )}

          <div className="content-header">
            <div className="header-actions">
              <button className="btn btn-compile" onClick={() => void handleCompile()}>
                Compile
              </button>
              <button className="btn btn-deploy" onClick={() => void 0}>
                Deploy
              </button>
              <button className="btn btn-scan" onClick={() => setActivePanel('security')}>
                Security Scan
              </button>
            </div>
            {compilationResult ? <div className="compile-hint">Compilation result available (mock).</div> : null}
          </div>

          <div className="content-area">
            {activePanel === 'editor' && (
              <SmartContractEditor onCompile={() => void handleCompile()} onDeploy={() => void 0} onAnalyze={() => setActivePanel('security')} />
            )}
            {activePanel === 'debugger' && <DebuggerPanel />}
            {activePanel === 'security' && <SecurityScanner code={code} contractName="MyContract" />}
            {activePanel === 'ipfs' && <IPFSBrowser />}
            {activePanel === 'templates' && <TemplateGallery />}
            {activePanel === 'plugins' && <PluginManager />}
          </div>
        </main>
      </div>

      <footer className="app-footer">
        <div className="footer-status">
          <span className="status-item">Language: {language.toUpperCase()}</span>
          <span className="status-item">Version: 0.3.0</span>
        </div>
      </footer>
    </div>
  );
}
