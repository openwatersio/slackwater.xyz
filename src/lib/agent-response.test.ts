import { describe, expect, it } from 'vitest'
import { agentResponse } from './agent-response'

const request = (accept?: string, path = '/', method = 'GET') => new Request(`https://slackwater.xyz${path}`, { method, headers: accept ? { Accept: accept } : {} })
const html = async () => new Response('<h1>Slackwater</h1>', { headers: { 'Content-Type': 'text/html', Vary: 'Accept-Encoding' } })

describe('document negotiation', () => {
  it.each([
    [undefined, 'text/html'], ['*/*', 'text/html'], ['text/*', 'text/html'],
    ['text/html', 'text/html'], ['text/markdown', 'text/markdown'],
    ['text/html;q=0.3, text/markdown;q=0.9', 'text/markdown'],
    ['text/markdown;q=0, */*;q=1', 'text/html'],
    ['text/html;q=0, text/markdown;q=0.5', 'text/markdown'],
    ['TEXT/MARKDOWN', 'text/markdown'],
    ['text/markdown; charset=UTF-8', 'text/markdown'],
    ['text/html; charset=utf-8', 'text/html'],
    ['text/*;q=0.5, text/markdown;q=0.5', 'text/markdown'],
    ['text/markdown;q=0.1, text/html;q=0.9', 'text/html'],
  ])('negotiates %s as %s', async (accept, type) => {
    const response = await agentResponse(request(accept), html)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain(type)
    expect(response.headers.get('vary')).toMatch(/Accept/)
    if (type === 'text/markdown') expect(await response.text()).toMatch(/^# Slackwater/)
  })

  it.each(['application/json', 'text/html;q=0, text/markdown;q=0', '*/*;q=0'])('rejects %s', async (accept) => {
    const response = await agentResponse(request(accept), html)
    expect(response.status).toBe(406)
    expect(response.headers.get('vary')).toContain('Accept')
  })

  it('preserves existing Vary values on HTML and exposes its alternate', async () => {
    const response = await agentResponse(request('text/html'), html)
    expect(response.headers.get('vary')).toBe('Accept-Encoding, Accept')
    expect(response.headers.get('link')).toContain('rel="alternate"; type="text/markdown"')
    expect(response.headers.get('link')).toContain('/llms.txt')
  })

  it.each(['/', '/about/', '/contact/', '/pricing/', '/support/', '/privacy/', '/accuracy/'])('serves meaningful markdown for %s', async (path) => {
    const response = await agentResponse(request('text/markdown', path), html)
    expect(response.status).toBe(200)
    expect((await response.text()).length).toBeGreaterThan(500)
  })

  it('gives missing pages recovery links while preserving the 404', async () => {
    const response = await agentResponse(request('text/markdown', '/does-not-exist'), async () => new Response('Not published', { status: 404, headers: { 'Content-Type': 'text/html' } }))
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('text/markdown')
    const body = await response.text()
    for (const path of ['/stations/', '/sitemap.xml', '/llms.txt', '/support/']) expect(body).toContain(path)
  })

  it('recovers a missing page even when the framework rejects Markdown before routing', async () => {
    const response = await agentResponse(request('text/markdown', '/missing'), async (retry?: Request) =>
      retry?.headers.get('Accept') === 'text/html'
        ? new Response('<h1>Not published</h1>', { status: 404, headers: { 'Content-Type': 'text/html' } })
        : new Response('Not acceptable', { status: 406 }))
    expect(response.status).toBe(404)
    expect(response.headers.get('content-type')).toContain('text/markdown')
  })

  it('does not negotiate API or binary responses', async () => {
    const response = await agentResponse(request('application/json', '/api/event', 'POST'), async () => new Response('ok'))
    expect(await response.text()).toBe('ok')
    expect(response.headers.has('vary')).toBe(false)
  })

  it('does not invent a markdown representation for station pages', async () => {
    const response = await agentResponse(request('text/markdown', '/tides/us/wa/seattle/'), html)
    expect(response.headers.get('content-type')).toBe('text/html')
  })

  it.each(['/opencpn/', '/learn/tides/', '/compare/best-tide-and-current-apps-iphone/', '/alternatives/tide-guide/'])(
    'serves the Markdown twin of %s',
    async (path) => {
      const response = await agentResponse(request('text/markdown', path), html)
      expect(response.headers.get('content-type')).toContain('text/markdown')
      expect(response.headers.get('link')).toContain(`<${path.slice(0, -1)}.md>; rel="alternate"`)
      expect(await response.text()).toMatch(/^# /)
    },
  )

  it.each(['/learn/slack-water/', '/stations/'])('fetches the prerendered twin of %s', async (path) => {
    const twin = `${path.slice(0, -1)}.md`
    const response = await agentResponse(request('text/markdown', path), async (retry?: Request) =>
      retry && new URL(retry.url).pathname === twin
        ? new Response('# Twin\n', { headers: { 'Content-Type': 'text/markdown' } })
        : new Response('<h1>HTML</h1>', { headers: { 'Content-Type': 'text/html' } }))
    expect(response.headers.get('content-type')).toContain('text/markdown')
    expect(await response.text()).toBe('# Twin\n')
  })

  it('serves prerendered files before asking the framework to render', async () => {
    const rendered: string[] = []
    const next = async (retry?: Request) => {
      rendered.push(new URL(retry?.url ?? 'https://slackwater.xyz/').pathname)
      return html()
    }
    const asset = async (file?: Request) =>
      new URL(file!.url).pathname === '/missing.md'
        ? new Response('Not found', { status: 404 })
        : new Response('# File\n', { headers: { 'Content-Type': 'text/markdown' } })
    for (const [path, accept] of [['/learn/slack-water/', 'text/html'], ['/learn/slack-water/', 'text/markdown'], ['/learn/slack-water.md', undefined]]) {
      await agentResponse(request(accept, path), next, asset)
    }
    expect(rendered).toEqual([])
    await agentResponse(request(undefined, '/missing.md'), next, asset)
    expect(rendered).toEqual(['/missing.md'])
  })

  it('answers HEAD without a body and with the negotiated headers', async () => {
    const response = await agentResponse(request('text/markdown', '/', 'HEAD'), html)
    expect(response.headers.get('content-type')).toContain('text/markdown')
    expect(await response.text()).toBe('')
  })
})

describe('agent mode', () => {
  it('answers /?mode=agent with JSON instead of the homepage', async () => {
    const response = await agentResponse(request('text/html', '/?mode=agent'), html)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(response.headers.get('x-robots-tag')).toBe('noindex')
    expect(response.headers.get('link')).toContain('<https://slackwater.xyz/>; rel="canonical"')
    const view = await response.json()
    expect(view.authentication.required).toBe(false)
    expect(view.endpoints.length).toBeGreaterThan(5)
    expect(view.markdown.pages).toContainEqual({ html: '/learn/slack-water/', markdown: '/learn/slack-water.md' })
  })

  it('leaves the homepage and other modes alone', async () => {
    for (const path of ['/', '/?mode=human', '/about/?mode=agent']) {
      const response = await agentResponse(request('text/html', path), html)
      expect(response.headers.get('content-type'), path).toContain('text/html')
    }
  })

  it('answers HEAD without a body', async () => {
    const response = await agentResponse(request(undefined, '/?mode=agent', 'HEAD'), html)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.text()).toBe('')
  })
})

it('serves current US pricing with its purchase periods and storefront qualification', async () => {
  const response = await agentResponse(request('text/markdown', '/pricing/'), html)
  expect(response.headers.get('content-type')).toContain('text/markdown')
  const body = await response.text()
  expect(body).toContain('US$7.99 per year')
  expect(body).toContain('US$69.99 once')
  expect(body).toContain('US App Store')
  expect(body).toContain('local currency')
  expect(body).toContain('renews automatically')
})
