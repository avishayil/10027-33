import { execSync } from 'node:child_process'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Build version shown at the bottom of the page: the commit's short id (CI: GITHUB_SHA; locally: git). */
function buildVersion() {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short=7 HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}

const base =
  process.env.VITE_BASE != null && process.env.VITE_BASE !== ''
    ? process.env.VITE_BASE
    : '/'

/**
 * Restrictive Content-Security-Policy for production builds (the dev server needs inline
 * scripts and a websocket, so it is only injected at build time). connect-src 'none' blocks every
 * fetch / XHR / beacon / websocket, scripts load only from this origin and forms post nowhere. It is
 * one layer, not a guarantee: it does not stop navigation or links the user follows, printing,
 * screenshots or browser extensions (docs/ARCHITECTURE.md, "Privacy limits").
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ')

const cspPlugin = {
  name: 'inject-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace(
      '<meta charset="UTF-8" />',
      `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n    <meta name="referrer" content="no-referrer" />`,
    )
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), cspPlugin],
  base,
  define: {
    __BUILD_VERSION__: JSON.stringify(buildVersion()),
  },
  // Property-based tests run hundreds of full analyses; CI runners are slower than a laptop.
  test: {
    testTimeout: 30000,
  },
})
