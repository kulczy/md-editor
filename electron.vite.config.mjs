import { defineConfig } from 'electron-vite'

export default defineConfig({
  main: { build: { rollupOptions: { input: 'src/main/index.js' } } },
  // Preload must be CommonJS: Electron runs preloads sandboxed, where ESM is unsupported.
  // package.json "type":"module" would otherwise emit an ESM .mjs that fails to load.
  preload: {
    build: {
      rollupOptions: {
        input: 'src/preload/index.js',
        output: { format: 'cjs', entryFileNames: 'index.cjs' }
      }
    }
  },
  renderer: {
    root: 'src/renderer',
    build: { rollupOptions: { input: 'src/renderer/index.html' } }
  }
})
