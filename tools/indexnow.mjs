// Reports the URLs a deploy changed to IndexNow, in two steps around
// `wrangler deploy` (.github/workflows/deploy.yml):
//
//   node tools/indexnow.mjs plan <file>    before: diff the live sitemaps against .output/public
//   node tools/indexnow.mjs submit <file>  after: POST what plan wrote
//
// The live sitemaps are the record of what was last published, so plan has to
// read them before the deploy replaces them. Submitting after the deploy means
// an engine that fetches straight away sees the new pages.
//
//   node tools/indexnow.mjs all <file>     by hand: list every live URL for submit
//
// The deploy only ever sends changes, so a page live before IndexNow was wired
// up is never sent. `all` backfills those, once. It is not for every deploy:
// repeating it daily is what IndexNow answers with a 429.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { addUrlset, changedUrls, ENDPOINT, HOST, payloads, sitemapIndex } from '../src/lib/indexnow.ts'

const [command, file] = process.argv.slice(2)
if (!['plan', 'all', 'submit'].includes(command) || !file) {
  console.error('usage: node tools/indexnow.mjs plan|all|submit <file>')
  process.exit(2)
}

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
  return response.text()
}

async function readSitemaps(read) {
  const entries = new Map()
  for (const url of sitemapIndex(await read('sitemap.xml'))) {
    const name = new URL(url).pathname.slice(1)
    addUrlset(entries, name, await read(name))
  }
  return entries
}

if (command === 'plan') {
  const live = await readSitemaps((name) => fetchText(`https://${HOST}/${name}`))
  const built = await readSitemaps((name) => readFileSync(`.output/public/${name}`, 'utf8'))
  const urls = changedUrls(live, built)
  writeFileSync(file, urls.map((u) => `${u}\n`).join(''))
  console.log(`${urls.length} of ${built.size} URLs changed since the live deploy`)
  for (const url of urls.slice(0, 50)) console.log(`  ${url}`)
  if (urls.length > 50) console.log(`  … and ${urls.length - 50} more`)
} else if (command === 'all') {
  const live = await readSitemaps((name) => fetchText(`https://${HOST}/${name}`))
  const urls = [...live.keys()].sort()
  writeFileSync(file, urls.map((u) => `${u}\n`).join(''))
  console.log(`${urls.length} URLs in the live sitemaps`)
} else {
  // No plan file means plan failed and already said why.
  const urls = existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean) : []
  if (urls.length === 0) {
    console.log('Nothing to submit.')
    process.exit(0)
  }
  for (const body of payloads(urls)) {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    })
    // 200 is accepted and 202 is accepted pending key validation, which is the
    // answer until an engine has fetched the key file once. Neither means indexed.
    console.log(`IndexNow: HTTP ${response.status} for ${body.urlList.length} URLs`)
    if (response.status !== 200 && response.status !== 202) {
      console.log(await response.text())
      process.exit(1)
    }
  }
}
