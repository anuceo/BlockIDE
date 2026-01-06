import { invoke } from '@tauri-apps/api/core';

export class PluginService {
  static async verifyPlugin(pluginId: string, onChainData: string): Promise<boolean> {
    return await invoke<boolean>('verify_plugin', {
      pluginId,
      onChainData,
    });
  }

  static async loadPlugin(name: string, wasmBytes: Uint8Array): Promise<void> {
    return await invoke('load_plugin', {
      name,
      wasmBytes: Array.from(wasmBytes),
    });
  }
}

