import { describe, expect, it } from 'vitest'
import { SERVER_NOW } from './use-live-now'

describe('SERVER_NOW', () => {
  it('carries the build clock, not a moment written into the source', () => {
    // Injected by Vite's `define` from one `new Date()` per build, so the
    // server and client bundles agree on it and every prerendered page is
    // dated the day it was built.
    expect(SERVER_NOW.toISOString()).toBe(__BUILD_NOW__)
  })
})
