import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { INDEXNOW_KEY } from '../src/lib/indexnow.ts'

const { version } = createRequire(import.meta.url)('@slackwater/database/package.json')

let worker
let base = process.argv[2]
if (!base) {
  const { unstable_startWorker } = await import('wrangler')
  // Watching thousands of prerendered station directories exhausts macOS watchers.
  worker = await unstable_startWorker({ config: '.output/server/wrangler.json', dev: { watch: false, server: { port: 0 }, inspector: false } })
  base = String(await worker.url)
}
try {
  const documents = ['/', '/about/', '/contact/', '/pricing/', '/support/', '/privacy/', '/accuracy/', '/opencpn/', '/stations/', '/learn/tides/', '/learn/slack-water/', '/compare/best-tide-and-current-apps-iphone/', '/alternatives/tide-guide/']
  let checks = 0
  async function get(path, accept, method = 'GET') {
    const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15000), method, headers: accept ? { Accept: accept } : {} })
    checks++
    return response
  }

  function assertFooter(html, path) {
    const footer = html.match(/<footer[\s\S]*?aria-label="Footer"[\s\S]*?<\/footer>/)?.[0]
    assert.ok(footer, `${path}: shared footer`)
    assert.equal([...html.matchAll(/aria-label="Footer"/g)].length, 1, `${path}: one footer navigation`)
    for (const href of ['/stations/', '/learn/tides/', '/learn/slack-water/', '/pricing/', '/about/', '/support/', '/contact/', '/privacy/', '/opencpn/']) {
      assert.ok(footer.includes(`href="${href}"`), `${path}: footer ${href}`)
    }
    assert.ok(footer.includes('Not for navigation.'), `${path}: safety notice`)
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
      if (!markdown) assertFooter(body, path)
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

  for (const path of ['/about', '/contact', '/pricing', '/support', '/privacy', '/accuracy']) {
    for (const accept of ['text/html', 'text/markdown']) {
      const response = await get(path, accept)
      assert.equal(response.status, 200, `${path}: ${accept}`)
      assert.ok(response.headers.get('content-type')?.includes(accept))
      await response.body?.cancel()
    }
  }
  for (const path of ['/tides/us/wa/seattle/', '/currents/ca/bc/dodd-narrows/', '/tides/', '/currents/']) {
    const response = await get(path, 'text/markdown')
    assert.equal(response.status, 200, path)
    assert.ok(response.headers.get('content-type')?.includes('text/html'), path)
    const html = await response.text()
    assert.match(html, /<h1[ >]/)
    assertFooter(html, path)
  }

  for (const path of ['/index.md', '/about.md', '/contact.md', '/pricing.md', '/support.md', '/privacy.md', '/accuracy.md', '/opencpn.md', '/stations.md', '/learn/tides.md', '/learn/slack-water.md', '/compare/best-tide-and-current-apps-iphone.md', '/compare/slackwater-vs-ayetides.md', '/alternatives/tide-guide.md']) {
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
      if (accept === 'text/html') assertFooter(body, path)
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
  assert.equal(graph.find((node) => node['@type'] === 'Organization').address.streetAddress, '411 Walnut St #15547')
  assert.ok(graph.find((node) => node['@type'] === 'Organization').description, 'Organization description')

  for (const slug of ['ogasawara', 'miyakeshima']) {
    for (const instant of ['', '/2026-11-03T09:00+09:00']) {
      const response = await get(`/og/tides/${slug}${instant}.png`)
      assert.equal(response.status, 200, `former share image ${slug}${instant}`)
      assert.ok(response.headers.get('content-type')?.includes('image/png'))
      assert.ok(!response.headers.get('cache-control')?.includes('immutable'))
    }
  }
  for (const path of ['/tides/jp/sumoto/', '/tides/jp/sumoto/2026-11-03T14:00+09:00']) {
    const response = await get(path, 'text/html')
    const html = await response.text()
    const image = html.match(/<meta property="og:image" content="([^"]*)"/)[1]
    assert.equal(new URL(image).searchParams.get('v'), version, `image data version on ${path}`)
    assert.ok(html.includes('Slackwater predicts tides and currents offline, on your phone'), `supported app pitch on ${path}`)
  }
  for (const path of ['/tides/jp/miyakejima-tsubota/', '/tides/jp/maizuru-kyoto/', '/tides/jp/maizuru/']) {
    const response = await get(path, 'text/html')
    const html = await response.text()
    assert.equal(html.match(/<meta name="apple-itunes-app" content="([^"]*)"/)[1], '', `unsupported app link on ${path}`)
    assert.ok(!html.includes('Slackwater predicts tides and currents offline, on your phone'), `unsupported app pitch on ${path}`)
  }

  for (const method of ['GET', 'HEAD']) {
    const agent = await get('/?mode=agent', undefined, method)
    assert.equal(agent.status, 200, `mode=agent ${method}`)
    assert.ok(agent.headers.get('content-type')?.includes('application/json'), `mode=agent ${method}`)
    assert.equal(agent.headers.get('x-robots-tag'), 'noindex')
    if (method === 'HEAD') {
      assert.equal(await agent.text(), '')
      continue
    }
    const view = await agent.json()
    assert.equal(view.authentication.required, false)
    for (const { markdown } of view.markdown.pages) {
      const twin = await get(markdown)
      assert.equal(twin.status, 200, markdown)
      assert.ok(twin.headers.get('content-type')?.includes('text/markdown'), markdown)
      assert.match(await twin.text(), /^# /, markdown)
    }
  }

  const premium = await get('/pricing/', 'text/markdown')
  const premiumCopy = await premium.text()
  assert.ok(premiumCopy.includes('One Premium. Two ways to pay.'))
  assert.ok(premiumCopy.includes('These prices stay the same as Premium grows.'))
  const screenshots = [...premiumCopy.matchAll(/!\[[^\]]*\]\((\/shots\/premium\/[^)]+)\)/g)]
  assert.equal(screenshots.length, 3)
  for (const [, src] of screenshots) {
    const response = await get(src)
    assert.equal(response.status, 200, src)
    assert.ok(response.headers.get('content-type')?.includes('image/webp'), src)
    assert.ok((await response.arrayBuffer()).byteLength > 1000, src)
  }

  const llms = await get('/llms.txt')
  assert.equal(llms.status, 200)
  const guidance = await llms.text()
  assert.match(guidance, /^# Slackwater\n\n> /)
  for (const url of [...guidance.matchAll(/\]\((https:\/\/slackwater\.xyz[^)]+)\)/g)].map((match) => match[1])) {
    const response = await get(new URL(url).pathname)
    assert.equal(response.status, 200, url)
    await response.body?.cancel()
  }
  const stationLocs = new Set()
  for (const name of ['sitemap.xml', 'sitemap-static.xml', 'sitemap-tides.xml', 'sitemap-currents.xml']) {
    const response = await get(`/${name}`)
    assert.equal(response.status, 200, name)
    assert.ok(response.headers.get('content-type')?.includes('xml'), name)
    const xml = await response.text()
    if (name === 'sitemap-tides.xml' || name === 'sitemap-currents.xml') {
      for (const [, path] of xml.matchAll(/<loc>https:\/\/slackwater\.xyz([^<]+)<\/loc>/g)) stationLocs.add(path)
    }
    assert.match(xml, /^<\?xml version="1.0" encoding="UTF-8"\?>/)
    assert.ok(xml.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'))
    assert.equal([...xml.matchAll(/<loc>/g)].length, [...xml.matchAll(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/g)].length)
    assert.ok(Buffer.byteLength(xml) < 50 * 1024 * 1024)
  }
  const index = await get('/stations.json')
  assert.equal(index.status, 200, 'stations.json')
  assert.ok(index.headers.get('content-type')?.includes('json'), 'stations.json')
  const { origin, license, attributions, stations } = await index.json()
  assert.equal(origin, 'https://slackwater.xyz')
  assert.ok(license, 'stations.json names its licence')
  // The served index and the served sitemaps list the same pages, so a stale file cannot pass.
  assert.deepEqual(new Set(stations.map((s) => s.path)), stationLocs, 'stations.json lists the sitemaps\' station pages')
  for (const s of stations) assert.ok(attributions[s.attribution]?.trim(), `stations.json: ${s.path} carries its attribution`)
  const key = await get(`/${INDEXNOW_KEY}.txt`)
  assert.equal(key.status, 200, 'IndexNow key file')
  assert.equal((await key.text()).trim(), INDEXNOW_KEY, 'IndexNow key file')
  const robots = await get('/robots.txt')
  assert.equal(robots.status, 200)
  assert.ok((await robots.text()).includes('Sitemap: https://slackwater.xyz/sitemap.xml'))

  const arran = await get('/currents/ca/bc/arran-rapids/')
  assert.equal(arran.status, 200)
  const arranHtml = await arran.text()
  assert.ok(arranHtml.includes('href="https://testflight.apple.com/join/5gwh791N"'))
  assert.ok(arranHtml.includes('Slackwater beta on TestFlight'))
  const banners = [...arranHtml.matchAll(/<meta\b[^>]*\bname=["']apple-itunes-app["'][^>]*>/gi)]
  assert.equal(banners.length, 1)
  assert.match(banners[0][0], /\bcontent=(?:""|'')/)

  const association = await get('/.well-known/apple-app-site-association')
  assert.equal(association.status, 200)
  const components = (await association.json()).applinks.details[0].components
  const currentRule = components.findIndex((rule) => rule['/'] === '/currents/*' && !rule.exclude)
  assert.ok(currentRule >= 0, 'ordinary current shares still open the app')
  for (const path of ['/currents/arran-rapids', '/currents/arran-rapids/*']) {
    const excluded = components.findIndex((rule) => rule['/'] === path && rule.exclude)
    assert.ok(excluded >= 0 && excluded < currentRule, `${path}: both app channels must land on the Beta web page`)
  }
  const tideRule = components.findIndex((rule) => rule['/'] === '/tides/*' && !rule.exclude)
  assert.ok(tideRule >= 0, 'ordinary tide shares still open the app')
  for (const slug of ['miyakejima-tsubota', 'maizuru-kyoto', 'maizuru']) {
    for (const path of [`/tides/${slug}`, `/tides/${slug}/*`]) {
      const excluded = components.findIndex((rule) => rule['/'] === path && rule.exclude)
      assert.ok(excluded >= 0 && excluded < tideRule, `${path}: unsupported app shares stay on the web`)
    }
  }
  console.log(`Passed ${checks} Worker endpoint checks at ${base}`)

} finally {
  await worker?.dispose()
}
