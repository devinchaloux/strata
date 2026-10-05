import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    // Plain Node by default: starting jsdom (a simulated browser) costs about a
    // second per file, and most test files are pure logic. A file that needs a
    // DOM says so on its first line:  // @vitest-environment jsdom
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
  },
})
