import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { SmartContractEditor } from './components/editor/SmartContractEditor';
import { NetworkSelector } from './components/blockchain/NetworkSelector';
import { WalletConnector } from './components/blockchain/WalletConnector';
import { GasEstimator } from './components/blockchain/GasEstimator';
import { SecurityScanner } from './components/security/SecurityScanner';
import { DebuggerPanel } from './components/debugger/DebuggerPanel';
import { IPFSBrowser } from './components/ipfs/IPFSBrowser';
import { TemplateGallery } from './components/templates/TemplateGallery';
import { PluginManager } from './components/plugins/PluginManager';
import { useEditorStore } from './stores/editorStore';
import { useBlockchainStore } from './stores/blockchainStore';
import './App.css';

function App() {
  const [activePanel, setActivePanel] = useState('editor');
  const [greeting, setGreeting] = useState('');
  const { initializeWorkspace } = useEditorStore();
  const { connections } = useBlockchainStore();

  useEffect(() => {
    void initializeWorkspace();
    invoke<string>('greet', { name: 'Blockchain Developer' })
      .then((result) => setGreeting(result))
      .catch(console.error);
  }, [initializeWorkspace]);

  const panels = [
    { id: 'editor', name: '📝 Editor', component: <SmartContractEditor /> },
    { id: 'debugger', name: '🐛 Debugger', component: <DebuggerPanel /> },
    { id: 'security', name: '🛡️ Security', component: <SecurityScanner /> },
    { id: 'ipfs', name: '📡 IPFS', component: <IPFSBrowser /> },
    { id: 'templates', name: '📚 Templates', component: <TemplateGallery /> },
    { id: 'plugins', name: '🔌 Plugins', component: <PluginManager /> },
  ];

  const ActivePanelComponent = panels.find((p) => p.id === activePanel)?.component;

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">🚀 Blockchain IDE</h1>
          <div className="app-subtitle">The First Trust-Minimized Development Environment</div>
          {greeting && <div className="app-greeting">{greeting}</div>}
        </div>

        <div className="header-right">
          <NetworkSelector />
          <WalletConnector />
        </div>
      </header>

      <div className="app-main">
        <aside className="app-sidebar">
          <div className="sidebar-header">
            <h3>Workspace</h3>
          </div>

          <div className="sidebar-panels">
            {panels.map((panel) => (
              <button
                key={panel.id}
                className={`sidebar-btn ${activePanel === panel.id ? 'active' : ''}`}
                onClick={() => setActivePanel(panel.id)}
                type="button"
              >
                {panel.name}
              </button>
            ))}
          </div>

          <div className="sidebar-connections">
            <h4>Connections</h4>
            {connections.length === 0 ? (
              <div className="no-connections">No wallets connected</div>
            ) : (
              connections.map((conn) => (
                <div key={conn.chain.id} className="connection-item">
                  <span className="connection-icon">
                    {conn.chain.id === 'ethereum' ? '🔷' : conn.chain.id === 'solana' ? '⚪' : '🔶'}
                  </span>
                  <span className="connection-name">{conn.chain.name}</span>
                  <span className="connection-status connected">●</span>
                </div>
              ))
            )}
          </div>

          <div className="sidebar-gas">
            <GasEstimator />
          </div>
        </aside>

        <main className="app-content">{ActivePanelComponent}</main>
      </div>

      <footer className="app-footer">
        <div className="footer-status">
          <span className="status-item">Blockchain IDE v0.3.0</span>
          <span className="status-item">
            {connections.length} wallet{connections.length !== 1 ? 's' : ''} connected
          </span>
          <span className="status-item">Built with Tauri + Rust + React</span>
        </div>
      </footer>
    </div>
  );
}

export default App;

