import { usePluginStore } from '../../stores/pluginStore';

export function PluginManager() {
  const { plugins, addPlugin, togglePlugin } = usePluginStore();

  return (
    <div style={{ padding: 12 }}>
      <h2 style={{ marginTop: 0 }}>Plugins</h2>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <button
          onClick={() =>
            addPlugin({
              id: `plugin-${Date.now()}`,
              name: 'Example Plugin',
              version: '1.0.0',
              enabled: true,
            })
          }
        >
          Add example
        </button>
      </div>

      {plugins.length === 0 ? (
        <div style={{ opacity: 0.8 }}>No plugins installed.</div>
      ) : (
        <ul style={{ paddingLeft: 18 }}>
          {plugins.map((p) => (
            <li key={p.id} style={{ marginBottom: 8 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={p.enabled} onChange={() => togglePlugin(p.id)} />
                <span>
                  {p.name} <span style={{ opacity: 0.7 }}>v{p.version}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

