import { useEffect, useState } from 'react';

type Level = { level: 'slow' | 'standard' | 'fast'; gwei: number; time: string };

export function GasEstimator() {
  const [data, setData] = useState<Level[]>([]);

  useEffect(() => {
    setData([
      { level: 'slow', gwei: 15, time: '~5 min' },
      { level: 'standard', gwei: 25, time: '~2 min' },
      { level: 'fast', gwei: 35, time: '~30 sec' },
    ]);
  }, []);

  return (
    <div style={{ padding: 12 }}>
      <h3 style={{ marginBottom: 10 }}>Gas</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {data.map((d) => (
          <div key={d.level} style={{ border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 10 }}>
            <div style={{ fontWeight: 700 }}>{d.level.toUpperCase()}</div>
            <div style={{ fontSize: 22 }}>{d.gwei} Gwei</div>
            <div style={{ opacity: 0.8, fontSize: 12 }}>{d.time}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

