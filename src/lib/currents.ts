import station from '../data/hero-station.json'
import type { BundledStation } from './station'

export const HERO_STATION: BundledStation = {
  // Slug must match station-metadata's slugs.json ('noaa/PUG1701' -> this) or
  // the prerender crawler 404s on the link this station renders to itself.
  id: station.id, kind: 'current', slug: 'deception-pass-narrows', name: station.name,
  latitude: station.latitude, longitude: station.longitude,
  timezone: 'America/Los_Angeles',
  source: 'bundled',
  constituents: station.constituents, offset: station.offset,
  floodDirection: station.floodDirection, ebbDirection: station.ebbDirection,
}
