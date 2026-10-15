import assert from 'node:assert/strict'

let worker
let base = process.argv[2]
if (!base) {
  const { unstable_startWorker } = await import('wrangler')
  // Watching thousands of prerendered station directories exhausts macOS watchers.
  worker = await unstable_startWorker({ config: '.output/server/wrangler.json', dev: { watch: false, server: { port: 0 }, inspector: false } })
  base = String(await worker.url)
}
try {
  const documents = ['/', '/about/', '/contact/', '/support/', '/privacy/', '/accuracy/']
  let checks = 0
  async function get(path, accept, method = 'GET') {
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15000), method, headers: accept ? { Accept: accept } : {} })
    checks++
    return response
  }

  for (const path of documents) {
    for (const accept of ['text/html', 'text/markdown', 'text/markdown; charset=utf-8', 'text/html;q=0.2, text/markdown;q=0.8', 'text/markdown;q=0, */*;q=1']) {
      const response = await get(path, accept)
      assert.equal(response.status, 200, `${path}: ${accept}`)
      const markdown = accept.startsWith('text/markdown; charset=') || accept === 'text/markdown' || accept.includes('q=0.8')
      assert.ok(response.headers.get('content-type')?.includes(markdown ? 'text/markdown' : 'text/html'), `${path}: ${accept}`)
      assert.match(response.headers.get('vary') ?? '', /(?:^|,\s*)Accept(?:,|$)/i)
      assert.ok(response.headers.get('link')?.includes('/llms.txt'))
      const body = await response.text()
      assert.ok(body.length > 500, path)
      assert.match(body, markdown ? /^# / : /<h1[ >]/)
    }
    const head = await get(path, 'text/markdown', 'HEAD')
    assert.equal(head.status, 200)
    assert.ok(head.headers.get('content-type')?.includes('text/markdown'))
    assert.equal(await head.text(), '')
    for (const accept of ['application/json', 'text/html;q=0, text/markdown;q=0']) {
      const rejected = await get(path, accept)
      assert.equal(rejected.status, 406)
      assert.match(rejected.headers.get('vary') ?? '', /Accept/i)
      const rejectedHead = await get(path, accept, 'HEAD')
      assert.equal(rejectedHead.status, 406)
      assert.equal(await rejectedHead.text(), '')
    }
  }

  for (const path of ['/about', '/contact', '/support', '/privacy', '/accuracy']) {
    for (const accept of ['text/html', 'text/markdown']) {
      const response = await get(path, accept)
      assert.equal(response.status, 200, `${path}: ${accept}`)
      assert.ok(response.headers.get('content-type')?.includes(accept))
      await response.body?.cancel()
    }
  }
  for (const path of ['/tides/us/wa/seattle/', '/learn/tides/', '/stations/']) {
    const response = await get(path, 'text/markdown')
    assert.equal(response.status, 200, path)
    assert.ok(response.headers.get('content-type')?.includes('text/html'), path)
    assert.match(await response.text(), /<h1[ >]/)
  }

  for (const path of ['/index.md', '/about.md', '/contact.md', '/support.md', '/privacy.md', '/accuracy.md']) {
    const response = await get(path)
    assert.equal(response.status, 200, path)
    assert.ok(response.headers.get('content-type')?.includes('text/markdown'), `${path}: content type`)
    assert.match(await response.text(), /^# /)
  }

  for (const path of ['/this-page-does-not-exist-agent-check', '/tides/this-station-does-not-exist/']) {
    for (const accept of ['text/html', 'text/markdown']) {
      const response = await get(path, accept)
      assert.equal(response.status, 404, path)
      assert.ok(response.headers.get('content-type')?.includes(accept))
      const body = await response.text()
      for (const link of ['/stations/', '/sitemap.xml', '/llms.txt', '/support/']) assert.ok(body.includes(link), `${path}: ${link}`)
      const head = await get(path, accept, 'HEAD')
      assert.equal(head.status, 404)
      assert.ok(head.headers.get('content-type')?.includes(accept))
      assert.equal(await head.text(), '')
    }
  }

  const homepage = await get('/', 'text/html')
  const page = await homepage.text()
  assert.match(page, /<html lang="en"/)
  assert.ok(page.includes('rel="canonical" href="https://slackwater.xyz/"'))
  assert.ok(page.includes('property="og:image"'))
  assert.ok(page.includes('property="og:type" content="website"'))
  const graph = JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph']
  assert.equal(graph.find((node) => node['@type'] === 'MobileApplication').name, 'Slackwater')
  assert.equal(graph.find((node) => node['@type'] === 'Organization').contactPoint.email, 'slackwater@openwaters.io')

  const llms = await get('/llms.txt')
  assert.equal(llms.status, 200)
  const guidance = await llms.text()
  assert.match(guidance, /^# Slackwater\n\n> /)
  for (const url of [...guidance.matchAll(/\]\((https:\/\/slackwater\.xyz[^)]+)\)/g)].map((match) => match[1])) {
    const response = await get(new URL(url).pathname)
    assert.equal(response.status, 200, url)
    await response.body?.cancel()
  }
  for (const name of ['sitemap.xml', 'sitemap-static.xml', 'sitemap-tides.xml', 'sitemap-currents.xml']) {
    const response = await get(`/${name}`)
    assert.equal(response.status, 200, name)
    assert.ok(response.headers.get('content-type')?.includes('xml'), name)
    const xml = await response.text()
    assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/)
    assert.ok(xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'))
    assert.equal([...xml.matchAll(/<loc>/g)].length, [...xml.matchAll(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g)].length)
    assert.ok(Buffer.byteLength(xml) < 50 * 1024 * 1024)
  }
  const robots = await get('/robots.txt')
  assert.equal(robots.status, 200)
  assert.ok((await robots.text()).includes('Sitemap: https://slackwater.xyz/sitemap.xml'))
  console.log(`Passed ${checks} Worker endpoint checks at ${base}`)

} finally {
  await worker?.dispose()
}
