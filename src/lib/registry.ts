//
// BUILD-TIME ONLY, like catalogue.ts — it pulls the whole registry.
//
// station-metadata owns curated identity: a hand-written name, a real region,
// and aliases. A provider row for the same water carries the provider's own
// name, which is why /currents/boundary-pass read "Turn Point, Boundary Pass"
// until this existed.
import registry from '@openwaters/station-metadata/data/registry.json' with { type: 'json' }
import slugTable from '@openwaters/station-metadata/data/slugs.json' with { type: 'json' }
import tzLookup from 'tz-lookup'
import type { ChsStation, Kind } from './station'

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

/** Every id station-metadata's registry names — the curated half of a merged pair. */
export const REGISTRY_IDS: ReadonlySet<string> = new Set(Object.keys(entries))

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

/**
 * Deferred by owner decision, and excluded by name because the registry
 * publishes it like any other gate — without this rule it would become a page
 * as a side effect of a data source. slackwater-ios excludes it fully as a
 * hazard call: violent rapids, "wrong water under a trusted name". Whether
 * official DFO predictions change that answer is an open question, not one to
 * settle by deleting this line.
 */
const EXCLUDED = new Set(['chs-arran-rapids'])

/**
 * The Canadian stations of one kind, from identity station-metadata already
 * publishes.
 *
 * No new package and no upstream release for either kind: all 24 gates and ten
 * of the tide ports are registry entries with a curated name, region and
 * corrected position. Only the timezone is derived, from the position.
 *
 * The other 1,048 CHS tide ports have identity nowhere published — that is the
 * rest of #17 and needs an operator run against IWLS, not a change here.
 */
export function chsStations(kind: Kind): ChsStation[] {
  const table = slugTable[kind] as Record<string, string>
  const out: ChsStation[] = []
  for (const [id, entry] of Object.entries(entries)) {
    if (entry.provider !== 'chs' || kindOf(entry) !== kind) continue
    if (EXCLUDED.has(id)) continue
    const slug = table[id]
    // A station with no published slug is a broken corpus, not one to skip: it
    // means the registry and the slug table disagree about what exists.
    if (!slug) throw new Error(`registry: no published slug for CHS ${kind} station ${id}`)
    const [latitude, longitude] = entry.position
    out.push({
      id, kind, slug, source: 'chs',
      name: entry.name,
      ...(entry.context ? { region: entry.context } : {}),
      // Carried through so the page knows not to offer a curve it cannot
      // fetch: a derived gate has no CHS current station, and resolving its
      // position would land on real water 47 km away down another inlet.
      ...(entry.derived ? { derived: true as const } : {}),
      latitude, longitude,
      timezone: tzLookup(latitude, longitude),
    })
  }
  return out
}
