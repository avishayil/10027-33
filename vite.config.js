import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const base =
  process.env.VITE_BASE != null && process.env.VITE_BASE !== ''
    ? process.env.VITE_BASE
    : '/'

/**
 * Restrictive Content-Security-Policy for production builds (the dev server needs inline
 * scripts and a websocket, so it is only injected at build time). connect-src 'none' means the
 * page cannot send personal data anywhere, even by accident.
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
})
