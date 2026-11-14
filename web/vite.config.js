import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// NEAR Wallet Selector uses Node's Buffer internally. In a browser, Vite
// externalizes that built-in module unless an explicit polyfill is configured.
export default defineConfig({
  base: '/',
  plugins: [
    nodePolyfills({
      globals: { Buffer: true, global: true, process: true },
      protocolImports: true,
    }),
  ],
  build: { outDir: 'dist', emptyOutDir: true },
  server: { port: 4173 },
  preview: { port: 4173 },
});
