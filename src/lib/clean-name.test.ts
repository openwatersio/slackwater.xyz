import { describe, expect, it } from 'vitest'
import { cleanName } from './clean-name'

describe('cleanName', () => {
  it('leaves an initialism inside a cased name alone', () => {
    // The database ships these cased already; title-casing them is the bug
    // this exists to stop.
    expect(cleanName("Martha's Vineyard GPS Buoy")).toBe("Martha's Vineyard GPS Buoy")
    expect(cleanName('J.F.K. International Airport')).toBe('J.F.K. International Airport')
    expect(cleanName('Pascagoula NOAA Lab')).toBe('Pascagoula NOAA Lab')
    expect(cleanName('Fort Eustis (MARAD)')).toBe('Fort Eustis (MARAD)')
  })

  it('calms a name that shouts in full', () => {
    expect(cleanName('CBBT')).toBe('Cbbt')
    expect(cleanName('LA PUSH')).toBe('La Push')
    expect(cleanName('USCG STATION NY')).toBe('USCG Station NY')
    expect(cleanName('DISCOVERY ISLAND, 7.6 MI. SSE OF')).toBe('Discovery Island, 6.6 nm SSE of')
  })

  it('spells out the abbreviations NOAA writes into names', () => {
    expect(cleanName('Minim Creek Ent.')).toBe('Minim Creek Entrance')
    expect(cleanName('Savage I.')).toBe('Savage Island')
    expect(cleanName('Mangrove Pt.')).toBe('Mangrove Point')
    expect(cleanName('Deception Pass St. Park')).toBe('Deception Pass State Park')
    // Only a trailing "I." is an island; one mid-name may be an initial.
    expect(cleanName('Spectacle I. and Long I.')).toBe('Spectacle I. and Long Island')
  })

  it('states every distance in nautical miles', () => {
    expect(cleanName('8 Miles Above Mouth')).toBe('7.0 nm Above Mouth')
    expect(cleanName('1 N.mi. Above Entrance')).toBe('1 nm Above Entrance')
    expect(cleanName('Cape Utalug (4 Miles West of)')).toBe('Cape Utalug (3.5 nm West of)')
    expect(cleanName('Six Mile Reef')).toBe('Six Mile Reef')
  })
})
