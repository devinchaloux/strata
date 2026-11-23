import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'node:child_process'

// The commit Help shows beside the version. On Vercel, take the commit it says
// it is building; elsewhere, ask git.
function buildCommit(): string {
  const vercel = process.env.VERCEL_GIT_COMMIT_SHA
  if (vercel) return vercel.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __STRATA_COMMIT__: JSON.stringify(buildCommit()),
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
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
