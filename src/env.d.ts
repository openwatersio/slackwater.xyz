/// <reference types="vite/client" />

/**
 * The build clock: one ISO timestamp, injected by `define` in both
 * vite.config.ts (server + client bundles) and vitest.config.ts.
 */
declare const __BUILD_NOW__: string

/**
 * Each static page's sitemap `<lastmod>`, keyed by path, from vite.config.ts.
 * Empty under vitest.
 */
declare const __LASTMOD__: Record<string, string>

/**
 * The installed `@slackwater/database` version, from both configs' `define`.
 * Not imported: its package.json shares a chunk with the station decoder.
 */
declare const __DATABASE_VERSION__: string

// Nitro's preset entry has no declaration; the alias is resolved in vite.config.ts.
declare module '#cloudflare-handler' {
  const handler: { fetch(request: Request, env: unknown, context: unknown): Promise<Response> }
  export default handler
}
