import { SmartContractEditor } from './components/editor/SmartContractEditor';
import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

export default function App() {
  const [tauriStatus, setTauriStatus] = useState<string>('Tauri: not connected (web mode)');

  useEffect(() => {
    // In web mode, this will typically fail (no Tauri runtime).
    invoke<string>('greet', { name: 'developer' })
      .then((msg) => setTauriStatus(msg))
      .catch(() => setTauriStatus('Tauri: not connected (web mode)'));
  }, []);

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <div
        style={{
          position: 'absolute',
          zIndex: 10,
          top: 8,
          left: 8,
          padding: '6px 10px',
          background: 'rgba(0,0,0,0.55)',
          color: 'white',
          fontFamily: 'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial',
          fontSize: 12,
          borderRadius: 8,
        }}
      >
        {tauriStatus}
      </div>
      <SmartContractEditor />
    </div>
  );
}
