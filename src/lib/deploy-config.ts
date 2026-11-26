/**
 * Checks the Worker config a build hands to the deploy, before wrangler reads
 * it with the Cloudflare token.
 *
 * The deploy and preview-upload jobs publish `.output/server/wrangler.json`
 * from the build job's artifact, and the build job runs every installed
 * dependency. Wrangler acts on that file: a `build.command` runs in a shell
 * on the runner holding the token, and `name`, `routes` or a binding would
 * point the token at another Worker, hostname or store. So the deploy job
 * accepts it only when it is exactly the reviewed `wrangler.jsonc` plus the
 * fields Nitro's cloudflare preset adds, which it checks from the same commit.
 *
 * No imports: the deploy job runs this with Node alone, before and without
 * `npm ci` of the site.
 */

/** What Nitro's cloudflare preset adds to the reviewed `wrangler.jsonc`, exactly. */
export const NITRO_ADDS = {
  main: 'index.mjs',
  no_bundle: true,
  rules: [{ type: 'ESModule', globs: ['**/*.mjs', '**/*.js'] }],
  assets: { binding: 'ASSETS', directory: '../public' },
} as const

/**
 * Parses `wrangler.jsonc`: JSON with `//` and block comments and trailing
 * commas, read character by character so a `//` inside a string, such as a
 * URL, stays in it.
 */
export function parseJsonc(text: string): unknown {
  let out = ''
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '"') {
      const start = i++
      while (i < text.length && text[i] !== '"') i += text[i] === '\\' ? 2 : 1
      out += text.slice(start, ++i)
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2)
      i = end === -1 ? text.length : end + 2
    } else {
      out += c
      i++
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'))
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

/** The config a build of `source` must produce: the reviewed file plus `NITRO_ADDS`, without its `$schema`. */
export function expectedConfig(source: Record<string, Json>): Record<string, Json> {
  const { $schema: _schema, ...reviewed } = source
  const assets = (reviewed.assets ?? {}) as Record<string, Json>
  return {
    ...reviewed,
    ...(NITRO_ADDS as unknown as Record<string, Json>),
    assets: { ...assets, ...NITRO_ADDS.assets },
  }
}

const same = (a: Json | undefined, b: Json | undefined): boolean => {
  if (a === b) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    return Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => same(v, b[i]))
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)])
    return [...keys].every((k) => same((a as Record<string, Json>)[k], (b as Record<string, Json>)[k]))
  }
  return false
}

/**
 * Every way the built config differs from what the reviewed source must
 * produce, one line each, top-level key by key; empty when they agree. A
 * `build` key is named first, since it is the one that runs on the runner.
 */
export function configProblems(source: Record<string, Json>, built: Record<string, Json>): string[] {
  const { $schema: _schema, ...rest } = built
  const expected = expectedConfig(source)
  const problems: string[] = []
  if ('build' in rest) problems.push('`build` is set: wrangler would run its command beside the token')
  const keys = new Set([...Object.keys(expected), ...Object.keys(rest)])
  for (const key of [...keys].sort()) {
    if (key === 'build') continue
    if (!same(expected[key], rest[key])) {
      problems.push(key in expected ? (key in rest ? `\`${key}\` differs from wrangler.jsonc` : `\`${key}\` is missing`) : `\`${key}\` is not in wrangler.jsonc`)
    }
  }
  return problems
}
