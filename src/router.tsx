import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // `public/_redirects` owns the trailing slash. The default, 'never', makes
    // the server 307 `/x/` to `/x`, which loops against a 308 rule sending `/x`
    // back to `/x/` on any such path without a prerendered page.
    trailingSlash: 'preserve',
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
