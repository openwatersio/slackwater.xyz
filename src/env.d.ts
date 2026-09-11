/// <reference types="vite/client" />

/**
 * The build clock: one ISO timestamp, injected by `define` in both
 * vite.config.ts (server + client bundles) and vitest.config.ts.
 */
declare const __BUILD_NOW__: string
