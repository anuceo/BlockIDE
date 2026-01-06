import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@components': resolve(__dirname, 'src/components'),
      '@services': resolve(__dirname, 'src/services'),
      '@stores': resolve(__dirname, 'src/stores'),
      '@types': resolve(__dirname, 'src/types'),
    },
  },
  optimizeDeps: {
    exclude: ['@tauri-apps/api'],
  },
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'editor-vendor': ['@monaco-editor/react', 'monaco-editor'],
          'web3-vendor': ['ethers', '@solana/web3.js'],
          'ui-vendor': ['zustand'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});

