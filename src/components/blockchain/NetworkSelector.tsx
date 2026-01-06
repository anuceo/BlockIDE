import { useBlockchainStore } from '../../stores/blockchainStore';

export function NetworkSelector() {
  const { currentChain, switchChain, multiChainService } = useBlockchainStore();
  const chains = multiChainService.getAllChains();

  return (
    <select value={currentChain} onChange={(e) => switchChain(e.target.value)} style={{ padding: 6, borderRadius: 6 }}>
      {chains.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </select>
  );
}

