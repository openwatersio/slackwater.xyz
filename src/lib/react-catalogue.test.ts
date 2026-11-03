import { describe, expect, it } from 'vitest'
import { loadCatalogue } from './catalogue'
import { loadStations } from '@slackwater/database'
import { getReactStation, listReactStations } from './react-catalogue'

const db = await loadStations()
describe('React catalogue boundary', () => {
  it('keeps curated identity, original credits and license on metadata', async () => {
    const item = await getReactStation({ kind: 'current', id: 'noaa/PUG1629' })
    expect(item.station.name).toBe('Yokeko Point, Deception Pass')
    expect(item.metadata.name).toBe(item.station.name)
    expect(item.metadata.attribution).toBe(db.byId(item.station.id)?.attribution)
    expect(item.metadata.license).toEqual(db.byId(item.station.id)?.license)
  })

  it('filters searches and limits nearby lists while measuring distance in kilometers', async () => {
    const rows = await listReactStations({
      kind: 'tide',
      params: { query: 'Seattle', maxResults: 3, latitude: 47.6, longitude: -122.3 },
    })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.length).toBeLessThanOrEqual(3)
    expect(rows.every((s) => s.license?.commercial_use === true)).toBe(true)
    expect(rows[0].distance).toBeLessThan(10)
    expect(rows.map((s) => s.distance)).toEqual(rows.map((s) => s.distance).sort((a, b) => a! - b!))
  })

  it('rejects a noncommercial station by direct id as well as excluding it from lists', async () => {
    const excluded = db.all.find((s) => s.license?.commercial_use === false)!
    await expect(getReactStation({ kind: excluded.kind, id: excluded.id })).rejects.toThrow(/station/i)
    expect(
      (await listReactStations({ kind: 'tide', params: { query: excluded.name } })).every(
        (s) => s.license?.commercial_use === true,
      ),
    ).toBe(true)
  })

  it('supports dateline-crossing boxes and rejects malformed parameters', async () => {
    const rows = await listReactStations({ kind: 'tide', params: { bbox: '178,-60,-178,60' } })
    expect(rows.length).toBeGreaterThan(0)
    expect(rows.every((s) => s.longitude >= 178 || s.longitude <= -178)).toBe(true)
    await expect(listReactStations({ kind: 'tide', params: { bbox: 'broken' } })).rejects.toThrow(/box/i)
    await expect(listReactStations({ kind: 'tide', params: { latitude: 91, longitude: 0 } })).rejects.toThrow(
      /position/i,
    )
    await expect(listReactStations({ kind: 'tide', params: { maxResults: 100000 } })).rejects.toThrow(/limit/i)
  })
})

it('returns every tide station in a viewport without an explicit result limit', async () => {
  const rows = await listReactStations({ kind: 'tide', params: { bbox: '-130,20,-60,55' } })
  const expected = loadCatalogue().filter((s) => s.kind === 'tide' && s.longitude >= -130 && s.longitude <= -60 && s.latitude >= 20 && s.latitude <= 55)
  expect(rows).toHaveLength(expected.length)
  expect(rows.some((s) => s.id === 'noaa/9447130')).toBe(true)
})

it('resolves exact accepted reference bins without duplicating station lists', async () => {
  const subordinate = await getReactStation({ kind: 'current', id: 'noaa/ACT0091' })
  if (subordinate.kind !== 'current') throw new Error('Expected current')
  const referenceId = subordinate.metadata.current?.offsets?.reference
  expect(referenceId).toBe('noaa/EPT0003@11')
  const reference = await getReactStation({ kind: 'current', id: referenceId! })
  expect(reference.station.id).toBe(referenceId)
  expect(reference.station.source).toBe('bundled')
  if (reference.station.source !== 'bundled') throw new Error('Expected bundled reference')
  expect(reference.station.constituents).toEqual(db.byId(referenceId!)?.harmonic_constituents)
  expect(reference.station.constituents).not.toEqual(db.byId('noaa/EPT0003')?.harmonic_constituents)
  expect(reference.metadata.license.commercial_use).toBe(true)
  const rows = await listReactStations({ kind: 'current', params: { bbox: '-180,-90,180,90' } })
  expect(rows.filter((s) => s.id.split('@')[0] === 'noaa/EPT0003')).toHaveLength(1)
})

it('resolves every exact current reference used by the published catalogue', async () => {
  const references = new Set(loadCatalogue().flatMap((s) =>
    s.kind === 'current' && s.source === 'bundled' && s.reduction ? [s.reduction.referenceId] : []))
  expect(references.size).toBeGreaterThan(0)
  for (const id of references) {
    const item = await getReactStation({ kind: 'current', id })
    expect(item.station.id).toBe(id)
    expect(item.metadata.license.commercial_use).toBe(true)
  }
})
