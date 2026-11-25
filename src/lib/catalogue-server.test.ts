import { describe, expect, it, vi } from 'vitest'

// A server function needs a Start server context to run. These tests are about
// what the handlers cost, not the RPC around them, so each one runs as a plain
// call. A plain export from `catalogue-server.ts` for a test to reach instead
// would pull the whole catalogue into the client bundle.
vi.mock('@tanstack/react-start', () => {
  const builder = {
    validator: () => builder,
    handler: (fn: (ctx: { data: unknown }) => unknown) => (ctx: { data: unknown }) => fn(ctx),
  }
  return { createServerFn: () => builder }
})

const { resolvePath } = await import('./catalogue-server')

describe('resolvePath', () => {
  it('answers the first station page of a cold isolate without ranking every station against every other', async () => {
    // The first station page a Worker isolate serves pays for everything the
    // catalogue builds lazily, all inside that one request. An all-pairs
    // neighbour map over the whole corpus cost about five seconds of CPU on a
    // laptop, several times that on a Worker, and cold isolates on
    // slackwater.xyz died with Cloudflare's 1102. One station's neighbours need
    // one scan of its own kind, and the whole cold request, catalogue load
    // included, takes a few hundred milliseconds. The budget leaves a slow CI
    // runner room while staying far below the all-pairs cost.
    const start = performance.now()
    const hit = await resolvePath({ data: { kind: 'current', path: '/currents/ca/bc/tillicum-bridge/' } })
    expect(performance.now() - start).toBeLessThan(2000)
    if (hit?.page !== 'station') throw new Error(`expected a station page, got ${hit?.page}`)
    expect(hit.nearby).toHaveLength(6)
    const nm = hit.nearby.map((r) => r.nm)
    expect(nm).toEqual([...nm].sort((a, b) => a - b))
  })
})
