import { loadCatalogue } from './src/lib/catalogue.ts'
const all = loadCatalogue()
for (const kind of ['tide','current']) {
  const s = all.filter(x=>x.kind===kind)
  const withRegion = s.filter(x=>x.region)
  const regions = new Set(withRegion.map(x=>x.region))
  const tzRoot = new Set(s.map(x=>x.timezone.split('/')[0]))
  console.log(`${kind}: ${s.length} stations | region present on ${withRegion.length} | ${regions.size} distinct regions | tz roots: ${[...tzRoot].join(', ')}`)
}
const tz = {}
for (const x of all) { const r = x.timezone.split('/')[0]; tz[r]=(tz[r]||0)+1 }
console.log('by tz root:', JSON.stringify(tz))
const sample = all.filter(x=>x.kind==='tide' && x.region).slice(0,5).map(x=>`${x.name} [${x.region}]`)
console.log('sample tide regions:', sample)
