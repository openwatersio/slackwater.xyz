// Reads the station index of a libtcd v2 file (XTide's TCD format): name,
// position, reference or subordinate, and whether it predicts a tide or a
// current. The layout follows read_tide_db_header and unpack_tide_record in
// libtcd 2.2.7's tide_db.c; only the fields up to a record's level units are
// decoded, because nothing here needs the constituents.
import { readFileSync } from 'node:fs'

/** MSB-first bit reader over a byte buffer, as libtcd's bit_unpack. */
function bits(buf) {
  const unsigned = (start, n) => {
    let v = 0
    for (let i = 0; i < n; i++) {
      const bit = start + i
      v = v * 2 + ((buf[bit >> 3] >> (7 - (bit & 7))) & 1)
    }
    return v
  }
  const signed = (start, n) => {
    const v = unsigned(start, n)
    return v >= 2 ** (n - 1) ? v - 2 ** n : v
  }
  return { unsigned, signed }
}

const cstring = (buf, start, size) => {
  const end = buf.indexOf(0, start)
  return buf.toString('utf8', start, Math.min(end === -1 ? start + size : end, start + size))
}

export function readTcd(path) {
  const buf = readFileSync(path)
  const asciiEnd = buf.indexOf('[END OF ASCII HEADER DATA]')
  const h = {}
  for (const line of buf.toString('latin1', 0, asciiEnd).split('\n')) {
    const m = line.match(/^\[(.+?)\]\s*=\s*(.*)$/)
    if (m) h[m[1]] = m[2].trim()
  }
  const n = (k) => {
    const v = Number(h[k])
    if (!Number.isFinite(v)) throw new Error(`${path}: no [${k}] in header`)
    return v
  }
  if (n('MAJOR REV') !== 2) throw new Error(`${path}: libtcd major rev ${h['MAJOR REV']} is not 2`)
  const bytes = (nbits) => Math.ceil(nbits / 8)
  const constituents = n('CONSTITUENTS')
  const years = n('NUMBER OF YEARS')

  // After the header and its 4-byte checksum, fixed-size string tables. The
  // level and direction unit tables hold exactly their TYPES; the others are
  // sized to every value their BITS can address.
  let pos = n('HEADER SIZE') + 4
  const levelUnits = []
  for (let i = 0; i < n('LEVEL UNIT TYPES'); i++, pos += n('LEVEL UNIT SIZE'))
    levelUnits.push(cstring(buf, pos, n('LEVEL UNIT SIZE')))
  pos += n('DIRECTION UNIT TYPES') * n('DIRECTION UNIT SIZE')
  pos += 2 ** n('RESTRICTION BITS') * n('RESTRICTION SIZE')
  pos += 2 ** n('TZFILE BITS') * n('TZFILE SIZE')
  pos += 2 ** n('COUNTRY BITS') * n('COUNTRY SIZE')
  pos += 2 ** n('DATUM BITS') * n('DATUM SIZE')
  pos += 2 ** n('LEGALESE BITS') * n('LEGALESE SIZE')
  pos += constituents * n('CONSTITUENT SIZE')
  pos += bytes(constituents * n('SPEED BITS'))
  pos += bytes(constituents * years * n('EQUILIBRIUM BITS'))
  pos += bytes(constituents * years * n('NODE BITS'))

  const stations = []
  for (let r = 0; r < n('NUMBER OF RECORDS'); r++) {
    const { unsigned, signed } = bits(buf.subarray(pos))
    let p = 0
    const size = unsigned(p, n('RECORD SIZE BITS')); p += n('RECORD SIZE BITS')
    const type = unsigned(p, n('RECORD TYPE BITS')); p += n('RECORD TYPE BITS')
    const latitude = signed(p, n('LATITUDE BITS')) / n('LATITUDE SCALE'); p += n('LATITUDE BITS')
    const longitude = signed(p, n('LONGITUDE BITS')) / n('LONGITUDE SCALE'); p += n('LONGITUDE BITS')
    p += n('TZFILE BITS')
    const str = () => {
      const start = pos + p / 8
      const end = buf.indexOf(0, start)
      p += (end - start + 1) * 8
      return buf.toString('utf8', start, end)
    }
    // Strings are byte-aligned only when the bits before them are; decode
    // them bit by bit otherwise.
    const string = () => {
      if (p % 8 === 0) return str()
      const out = []
      for (;;) {
        const c = unsigned(p, 8); p += 8
        if (!c) break
        out.push(c)
      }
      return Buffer.from(out).toString('utf8')
    }
    const name = string()
    p += n('STATION BITS') // reference station
    p += n('COUNTRY BITS')
    string() // source
    p += n('RESTRICTION BITS')
    string() // comments
    string() // notes
    p += n('LEGALESE BITS')
    const context = string() // station_id_context
    const id = string() // station_id
    p += n('DATE BITS') // date imported
    string() // xfields
    p += n('DIRECTION UNIT BITS') + 2 * n('DIRECTION BITS')
    const level = levelUnits[unsigned(p, n('LEVEL UNIT BITS'))]
    if (!size) throw new Error(`${path}: record ${r} has no size`)
    stations.push({
      name, latitude, longitude,
      id, context,
      reference: type === 1,
      kind: /^knots/.test(level ?? '') ? 'current' : 'tide',
      level,
    })
    pos += size
  }
  if (pos !== n('END OF FILE')) throw new Error(`${path}: records end at ${pos}, header says ${h['END OF FILE']}`)
  return stations
}

/**
 * The station index of an XTide harmonics IDX file, as OpenCPN ships beside
 * HARMONICS_NO_US: one line per station, `T`/`C` for a reference tide or
 * current and `t`/`c` for a subordinate, then region, longitude, latitude,
 * zone and name.
 */
export function readIdx(path) {
  const stations = []
  for (const line of readFileSync(path, 'latin1').split(/\r?\n/)) {
    // The zone can follow the latitude with no space: `50.3760-8:0`.
    const m = line.match(/^([TCtc])[A-Za-z]{3}:(\S*)\s+(-?\d+(?:\.\d*)?)\s+(-?\d+(?:\.\d*)?)\s*(-?\d+:\d+)\s+(.*)$/)
    if (!m) {
      if (/^[TCtc][A-Za-z]{3}:/.test(line)) throw new Error(`${path}: unreadable station line: ${line}`)
      continue
    }
    stations.push({
      name: m[6].trim(),
      // `Reg:Co:St`, the country being XTide's three-letter code: `Can`, `Jpn`.
      country: m[2].split(':')[0],
      longitude: Number(m[3]), latitude: Number(m[4]),
      reference: m[1] === 'T' || m[1] === 'C',
      kind: m[1].toLowerCase() === 'c' ? 'current' : 'tide',
    })
  }
  return stations
}
