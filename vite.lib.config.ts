import { defineConfig } from 'vite';
export default defineConfig({
  build: {
    outDir: 'lib', lib: { entry: 'src/index.ts', formats: ['es'], fileName: 'index', cssFileName: 'style' },
    rollupOptions: { external: ['react', 'react/jsx-runtime', 'react/jsx-dev-runtime'] }
  }
});
