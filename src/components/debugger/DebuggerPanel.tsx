import { useState } from 'react';
import { GasEstimator } from '../blockchain/GasEstimator';

export function DebuggerPanel() {
  const [tab, setTab] = useState<'gas' | 'tx' | 'stack' | 'vars'>('gas');

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', gap: 8, padding: 10, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <button onClick={() => setTab('gas')}>Gas</button>
        <button onClick={() => setTab('tx')}>Transaction</button>
        <button onClick={() => setTab('stack')}>Call Stack</button>
        <button onClick={() => setTab('vars')}>Variables</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {tab === 'gas' && <GasEstimator />}
        {tab !== 'gas' && <div style={{ padding: 12, opacity: 0.8 }}>Coming soon.</div>}
      </div>
    </div>
  );
}

