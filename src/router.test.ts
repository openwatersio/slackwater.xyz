import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory } from '@tanstack/react-router'

// One moved station; every other path has no page.
vi.mock('#/lib/catalogue-server', () => ({
  resolvePath: async ({ data }: { data: { path: string } }) =>
    data.path === '/tides/us/sc/moved/' ? { page: 'redirect', path: '/tides/us/ga/moved/' } : undefined,
  stationBySlug: async () => undefined,
}))

const { getRouter } = await import('./router')

/** What the Start handler reads to choose between a redirect and a status. */
async function serve(url: string) {
  const router = getRouter()
  router.update({ ...router.options, history: createMemoryHistory({ initialEntries: [url] }), isServer: true })
  await router.load()
  const result = router._serverResult!
  return result.type === 'redirect'
    ? { status: result.redirect.status, location: result.redirect.headers.get('Location') }
    : { status: result.status }
}

/**
 * `public/_redirects` sends `/tides/us/pa/x` to `/tides/us/pa/x/` with a 308
 * before the Worker sees it. Prerendered pages answer the slashed URL as a
 * static asset, so only paths without one reach the router. If the router
 * then canonicalises the slash away, it 307s back to `/x` and the two loop.
 */
describe('slashed paths the Worker answers', () => {
  it.each(['/tides/us/pa/nonexistent/', '/currents/zz/', '/nonexistent/'])('%s is a 404', async (url) => {
    expect(await serve(url)).toEqual({ status: 404 })
  })

  it("redirects a moved station's former address to its page now", async () => {
    expect(await serve('/tides/us/sc/moved/')).toEqual({ status: 301, location: '/tides/us/ga/moved/' })
  })
})
