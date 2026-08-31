//
// BUILD-TIME ONLY, like catalogue.ts — it pulls the whole registry.
//
// station-metadata owns curated identity: a hand-written name, a real region,
// and aliases. A provider row for the same water carries the provider's own
// name, which is why /currents/boundary-pass read "Turn Point, Boundary Pass"
// until this existed.
import registry from '@openwaters/station-metadata/data/registry.json' with { type: 'json' }
import slugTable from '@openwaters/station-metadata/data/slugs.json' with { type: 'json' }
import type { Kind } from './station'

interface RegistryEntry {
  name: string
  context?: string
  position: [number, number]
  provider?: string
  kind?: string
  aliases?: string[]
  derived?: unknown
}

const entries = registry as unknown as Record<string, RegistryEntry>

/** A registry entry with no `kind` is a current gate — the registry's own rule. */
const kindOf = (e: RegistryEntry): Kind => (e.kind === 'tide' ? 'tide' : 'current')

export interface Curated {
  name: string
  region?: string
}

/**
 * Curated identity for one kind, keyed by SLUG rather than id.
 *
 * Slug is the join key because that is how station-metadata expresses "these
 * two ids are one station": 4.1.2 merged four duplicate pairs by pointing both
 * ids at one slug. An id join would miss every one of them.
 */
export function curatedBySlug(kind: Kind): Map<string, Curated> {
  const table = slugTable[kind] as Record<string, string>
  const out = new Map<string, Curated>()
  for (const [id, entry] of Object.entries(entries)) {
    if (kindOf(entry) !== kind) continue
    const slug = table[id]
    if (!slug) continue
    out.set(slug, { name: entry.name, ...(entry.context ? { region: entry.context } : {}) })
  }
  return out
}
