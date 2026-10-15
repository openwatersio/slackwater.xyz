import Negotiator from 'negotiator'
import home from '../content/home.md?raw'
import about from '../content/about.md?raw'
import pricing from '../content/pricing.md?raw'
import contact from '../content/contact.md?raw'
import support from '../content/support.md?raw'
import privacy from '../content/privacy.md?raw'
import accuracy from '../content/accuracy.md?raw'

const DOCUMENTS: Record<string, { body: string; alternate: string }> = {
  '/': { body: home, alternate: '/index.md' },
  '/pricing/': { body: pricing, alternate: '/pricing.md' },
  '/about/': { body: about, alternate: '/about.md' },
  '/contact/': { body: contact, alternate: '/contact.md' },
  '/support/': { body: support, alternate: '/support.md' },
  '/privacy/': { body: privacy, alternate: '/privacy.md' },
  '/accuracy/': { body: accuracy, alternate: '/accuracy.md' },
}

const NOT_FOUND = `# Page not found

There is no published page at this URL. A station may not be published on this website yet.

- [Slackwater](https://slackwater.xyz/)
- [Station directory](https://slackwater.xyz/stations/)
- [Sitemap](https://slackwater.xyz/sitemap.xml)
- [Agent guidance](https://slackwater.xyz/llms.txt)
- [Support](https://slackwater.xyz/support/)
`

function varyAccept(headers: Headers) {
  const vary = headers.get('Vary')?.split(',').map((value) => value.trim()) ?? []
  if (!vary.some((value) => ['accept', '*'].includes(value.toLowerCase()))) vary.push('Accept')
  headers.set('Vary', vary.join(', '))
}

export async function agentResponse(request: Request, next: (request?: Request) => Promise<Response>): Promise<Response> {
  if (!['GET', 'HEAD'].includes(request.method)) return next()
  const path = new URL(request.url).pathname
  const document = DOCUMENTS[path.endsWith('/') ? path : `${path}/`]
  const negotiator = new Negotiator({ headers: { accept: request.headers.get('Accept') ?? '*/*' } })
  const type = negotiator.mediaType(['text/html; charset=utf-8', 'text/markdown; charset=utf-8'])?.split(';')[0]
  let response: Response
  if (document && !type) {
    response = new Response('Available representations: text/html, text/markdown.\n', {
      status: 406, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  } else if (document && type === 'text/markdown') {
    response = new Response(document.body, { headers: { 'Content-Type': 'text/markdown; charset=utf-8' } })
  } else {
    response = await next()
  }
  // TanStack can reject Markdown before resolving whether the path exists.
  if (!document && type === 'text/markdown' && response.status === 406) {
    const headers = new Headers(request.headers)
    headers.set('Accept', 'text/html')
    const html = await next(new Request(request, { headers }))
    if (html.status === 404) {
      await response.body?.cancel()
      response = html
    } else {
      await html.body?.cancel()
    }
  }
  const missing = response.status === 404 && response.headers.get('Content-Type')?.includes('text/html')
  if (!document && !missing) return response
  if (missing && type === 'text/markdown') {
    response = new Response(NOT_FOUND, { status: 404, headers: { 'Content-Type': 'text/markdown; charset=utf-8' } })
  }
  const headers = new Headers(response.headers)
  varyAccept(headers)
  // Validators from an HTML asset must never validate a different representation.
  if (type === 'text/markdown' || response.status === 406) headers.set('Cache-Control', 'no-store')
  const links = ['</llms.txt>; rel="describedby"']
  if (document) links.push(`<${document.alternate}>; rel="alternate"; type="text/markdown"`)
  headers.append('Link', links.join(', '))
  return new Response(request.method === 'HEAD' ? null : response.body, { status: response.status, statusText: response.statusText, headers })
}
