import React, { useState } from 'react';
import { useBlockchainStore } from '../../stores/blockchainStore';

export const NetworkSelector: React.FC = () => {
  const { currentChain, switchChain } = useBlockchainStore();
  const [isOpen, setIsOpen] = useState(false);

  const networks = [
    { id: 'ethereum', name: 'Ethereum', icon: '🔷' },
    { id: 'polygon', name: 'Polygon', icon: '🟣' },
    { id: 'bsc', name: 'BSC', icon: '🟡' },
    { id: 'solana', name: 'Solana', icon: '⚪' },
  ];

  const currentNetwork = networks.find((n) => n.id === currentChain) || networks[0];

  const handleNetworkChange = async (networkId: string) => {
    await switchChain(networkId);
    setIsOpen(false);
  };

  return (
    <div className="network-selector">
      <button className="network-selector-btn" onClick={() => setIsOpen(!isOpen)} type="button">
        <span className="network-icon">{currentNetwork.icon}</span>
        <span className="network-name">{currentNetwork.name}</span>
        <span className="network-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="network-dropdown">
          {networks.map((network) => (
            <button
              key={network.id}
              className={`network-item ${currentChain === network.id ? 'active' : ''}`}
              onClick={() => void handleNetworkChange(network.id)}
              type="button"
            >
              <span className="network-icon">{network.icon}</span>
              <span className="network-name">{network.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

