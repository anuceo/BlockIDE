import React, { useState } from 'react';
import { useBlockchainStore } from '../../stores/blockchainStore';

export const WalletConnector: React.FC = () => {
  const { connections, connectWallet, disconnectWallet } = useBlockchainStore();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connectWallet('ethereum', 'metamask');
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    connections.forEach((conn) => {
      disconnectWallet(conn.chain.id);
    });
  };

  if (connections.length > 0) {
    const firstConnection = connections[0];
    const shortAddress = `${firstConnection.address.slice(0, 6)}...${firstConnection.address.slice(-4)}`;

    return (
      <div className="wallet-connected">
        <span className="wallet-address">{shortAddress}</span>
        <button className="btn btn-disconnect" onClick={handleDisconnect} type="button">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button className="btn btn-connect" onClick={() => void handleConnect()} disabled={isConnecting} type="button">
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </button>
  );
};

