import { useState } from 'react';
import { useBlockchainStore } from '../../stores/blockchainStore';

export function WalletConnector() {
  const { currentChain, connectWallet, connections, disconnectWallet } = useBlockchainStore();
  const [error, setError] = useState<string | null>(null);
  const connected = connections.find((c) => c.chain.id === currentChain);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {connected ? (
        <>
          <span style={{ fontSize: 12, opacity: 0.9 }}>
            {connected.address.slice(0, 6)}…{connected.address.slice(-4)}
          </span>
          <button
            onClick={() => disconnectWallet(currentChain)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)' }}
          >
            Disconnect
          </button>
        </>
      ) : (
        <button
          onClick={async () => {
            setError(null);
            try {
              await connectWallet(currentChain, 'metamask');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Failed to connect wallet');
            }
          }}
          style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.2)' }}
        >
          Connect Wallet
        </button>
      )}
      {error && <span style={{ fontSize: 12, color: '#ffb4b4' }}>{error}</span>}
    </div>
  );
}

