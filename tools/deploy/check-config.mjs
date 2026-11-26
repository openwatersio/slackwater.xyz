// Refuses a built Worker config that isn't the reviewed one, before the
// deploy hands it to wrangler with the Cloudflare token. See
// src/lib/deploy-config.ts.
//
//   node tools/deploy/check-config.mjs wrangler.jsonc .output/server/wrangler.json

import { readFileSync } from 'node:fs'
import { configProblems, parseJsonc } from '../../src/lib/deploy-config.ts'

const [sourcePath, builtPath] = process.argv.slice(2)
if (!sourcePath || !builtPath) {
  console.error('usage: node tools/deploy/check-config.mjs <wrangler.jsonc> <built wrangler.json>')
  process.exit(2)
}
const problems = configProblems(parseJsonc(readFileSync(sourcePath, 'utf8')), JSON.parse(readFileSync(builtPath, 'utf8')))
if (problems.length) {
  for (const p of problems) console.error(`::error::${builtPath}: ${p}`)
  console.error('A Nitro upgrade that changes the generated config updates NITRO_ADDS in src/lib/deploy-config.ts, in review.')
  process.exit(1)
}
console.log(`${builtPath} is wrangler.jsonc as reviewed, plus what Nitro adds`)
