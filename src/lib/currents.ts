import station from '../data/hero-station.json'
import type { BundledStation } from './station'

export const HERO_STATION: BundledStation = {
  id: station.id, kind: 'current', slug: 'deception-pass', name: station.name,
  latitude: station.latitude, longitude: station.longitude,
  timezone: 'America/Los_Angeles',
  source: 'bundled',
  constituents: station.constituents, offset: station.offset,
  floodDirection: station.floodDirection, ebbDirection: station.ebbDirection,
}
