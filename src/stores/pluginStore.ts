import { create } from 'zustand';

export interface PluginListItem {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
}

interface PluginState {
  plugins: PluginListItem[];
  addPlugin: (p: PluginListItem) => void;
  togglePlugin: (id: string) => void;
}

export const usePluginStore = create<PluginState>((set) => ({
  plugins: [],
  addPlugin: (p) => set((s) => ({ plugins: [...s.plugins, p] })),
  togglePlugin: (id) =>
    set((s) => ({
      plugins: s.plugins.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p)),
    })),
}));

