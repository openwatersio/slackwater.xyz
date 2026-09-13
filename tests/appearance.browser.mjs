import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { after, test } from 'node:test'

// Run against pnpm preview; NODE_PATH can point to an existing Playwright installation.
const { chromium } = createRequire(import.meta.url)('playwright')
const browser = await chromium.launch({ channel: 'chrome', headless: true })
after(() => browser.close())
const base = process.env.PREVIEW_URL ?? 'http://localhost:8787'

async function open(mode, { system = 'dark', instant, observer, viewport = { width: 1440, height: 1000 }, route = '/' } = {}) {
  const context = await browser.newContext({ viewport, colorScheme: system, geolocation: observer, permissions: observer ? ['geolocation'] : [] })
  const page = await context.newPage()
  await page.addInitScript((saved) => {
    localStorage.setItem('slackwater-theme', saved)
    window.skyFrames = []
    const prototype = CanvasRenderingContext2D.prototype
    const clear = prototype.clearRect
    prototype.clearRect = function (...args) {
      if (this.canvas.isConnected) {
        this.skyFrame = { arcs: [], angle: 0 }
        window.skyFrames.push(this.skyFrame)
      }
      return clear.apply(this, args)
    }
    const arc = prototype.arc
    prototype.arc = function (...args) {
      this.skyFrame?.arcs.push(args.slice(0, 3))
      return arc.apply(this, args)
    }
    const rotate = prototype.rotate
    prototype.rotate = function (angle) {
      if (this.skyFrame) this.skyFrame.angle = angle
      return rotate.call(this, angle)
    }
  }, mode)
  if (instant) await page.clock.install({ time: new Date(instant) })
  assert.equal((await page.goto(base + route)).status(), 200)
  await page.waitForFunction(() => document.querySelector('[popoverTarget]') && window.skyFrames.length)
  await page.waitForTimeout(850)
  return { page, close: () => context.close() }
}

async function contrast(page, selector) {
  return page.locator(selector).first().evaluate((element) => {
    const scratch = document.createElement('canvas').getContext('2d')
    const rgba = (css) => {
      scratch.clearRect(0, 0, 1, 1)
      scratch.fillStyle = css
      scratch.fillRect(0, 0, 1, 1)
      return [...scratch.getImageData(0, 0, 1, 1).data]
    }
    const over = (ink, ground) => ink.slice(0, 3).map((channel, i) => channel * ink[3] / 255 + ground[i] * (1 - ink[3] / 255))
    const luminance = (rgb) => rgb.map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
    const canvas = document.querySelector('canvas')
    const context = canvas.getContext('2d')
    const bounds = element.getBoundingClientRect()
    const ink = rgba(getComputedStyle(element).color)
    const ground = rgba(getComputedStyle(document.body).backgroundColor)
    let minimum = Infinity
    let background
    for (let y = bounds.top + 2; y < Math.min(innerHeight, bounds.bottom); y += 4) {
      for (let x = bounds.left + 2; x < Math.min(innerWidth, bounds.right); x += 4) {
        let bg = over([...context.getImageData(Math.floor(x * canvas.width / innerWidth), Math.floor(y * canvas.height / innerHeight), 1, 1).data], ground)
        const ancestors = []
        for (let node = element; node && node !== document.body; node = node.parentElement) ancestors.unshift(node)
        for (const node of ancestors) bg = over(rgba(getComputedStyle(node).backgroundColor), bg)
        const values = [luminance(over(ink, bg)), luminance(bg)].sort((a, b) => b - a)
        const ratio = (values[0] + 0.05) / (values[1] + 0.05)
        if (ratio < minimum) { minimum = ratio; background = bg.map(Math.round) }
      }
    }
    return { ratio: minimum, ink, background }
  })
}

test('the sky fades into the page ground and keeps both palettes readable', async () => {
  for (const mode of ['light', 'night']) {
    for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]) {
      const { page, close } = await open(mode, { viewport })
      try {
        const bottom = await page.locator('canvas').evaluate((canvas) => [...canvas.getContext('2d').getImageData(1, canvas.height - 1, 1, 1).data])
        assert.equal(bottom[3], 0, `${mode}: the viewport bottom must expose the page ground`)
        for (const selector of ['h1', 'header p.text-sw-foam', 'header p.text-sw-steel']) {
          const measured = await contrast(page, selector)
          console.log('CONTRAST', mode, viewport.width, selector, measured)
          assert(measured.ratio >= (selector === 'h1' ? 3 : 4.5), JSON.stringify(measured))
        }
      } finally { await close() }
    }
  }
})

test('filled CTAs keep readable ink in both palettes and hover states', async () => {
  for (const mode of ['light', 'night']) {
    for (const route of ['/', '/tides/friday-harbor/']) {
      const { page, close } = await open(mode, { route })
      try {
        const selector = 'a.bg-sw-leaf'
        await page.locator(selector).first().scrollIntoViewIfNeeded()
        for (const hover of [false, true]) {
          if (hover) await page.locator(selector).first().hover()
          await page.waitForTimeout(250)
          const measured = await contrast(page, selector)
          console.log('CTA', mode, route, hover, measured)
          assert(measured.ratio >= 4.5, JSON.stringify(measured))
        }
      } finally { await close() }
    }
  }
})

test('light tide charts keep day and night distinct with readable labels', async () => {
  const { page, close } = await open('light', {
    instant: '2026-09-12T19:00:00Z', route: '/tides/friday-harbor/',
    viewport: { width: 390, height: 844 },
  })
  try {
    const chart = page.locator('svg[aria-label^="Tide predictions"]:visible').first()
    const colors = await chart.evaluate((svg) => {
      const style = (selector) => getComputedStyle(svg.querySelector(selector))
      const curve = svg.querySelector('path[stroke="#38BDF8"]')
      return {
        night: style('[data-shade="night"]').fill,
        day: style('[data-shade="daylight"]').fill,
        dayOpacity: Number(style('[data-shade="daylight"]').fillOpacity),
        curveInks: [...svg.querySelectorAll('path[fill="none"]')]
          .filter((path) => path.getAttribute('d') === curve.getAttribute('d'))
          .map((path) => getComputedStyle(path).stroke),
        high: style('text[fill="#2DD4BF"]').fill,
        low: style('text[fill="#FBBF24"]').fill,
        halo: style('text[fill="#2DD4BF"]').stroke,
      }
    })
    const pageGround = await page.locator('body').evaluate((body) => getComputedStyle(body).backgroundColor)
    const sunrise = await page.locator('.text-sw-sunrise').first().evaluate((label) => getComputedStyle(label).color)
    const sunset = await page.locator('.text-sw-sunset').first().evaluate((label) => getComputedStyle(label).color)
    const rgb = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number)
    const luminance = (value) => rgb(value).map((v) => v / 255).map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [0.2126, 0.7152, 0.0722][i], 0)
    const contrast = (a, b) => (Math.max(luminance(a), luminance(b)) + 0.05) / (Math.min(luminance(a), luminance(b)) + 0.05)
    const night = rgb(colors.night)
    const day = rgb(colors.day).map((v, i) => v * colors.dayOpacity + night[i] * (1 - colors.dayOpacity))
    const dayColor = `rgb(${day.join(',')})`
    assert(luminance(colors.night) > 0.04, `night water is still near-black: ${colors.night}`)
    assert(luminance(dayColor) > luminance(colors.night) + 0.05, 'daylight must visibly lift the night water')
    assert(colors.curveInks.some((ink) => contrast(ink, colors.night) >= 3), 'curve must separate from night water')
    assert(colors.curveInks.some((ink) => contrast(ink, dayColor) >= 3), 'curve must separate from daylight water')
    for (const ink of [colors.high, colors.low, sunrise, sunset]) {
      assert(contrast(ink, pageGround) >= 4.5, `${ink} is unreadable on ${pageGround}`)
    }
    assert(contrast(colors.halo, pageGround) < 1.5, 'light labels must not retain a dark outline')
    for (const water of [colors.night, dayColor]) {
      assert(contrast(colors.halo, water) >= 3, `label outline is unreadable on ${water}`)
    }
  } finally { await close() }
})

test('the daylight glow fades to the sun hue without a dark ring', async () => {
  const { page, close } = await open('light')
  try {
    const pixels = await page.locator('canvas').evaluate((canvas) => {
      const context = canvas.getContext('2d')
      const [x, y] = window.skyFrames.at(-1).arcs.find((arc) => arc[2] === 20)
      const ground = [238, 246, 243]
      const at = (x) => {
        const color = [...context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data]
        return color.slice(0, 3).map((value, i) => value * color[3] / 255 + ground[i] * (1 - color[3] / 255))
      }
      return { glow: at(x + 45), backdrop: at(x + 90) }
    })
    console.log('SUN GLOW', pixels)
    assert(pixels.glow[0] >= pixels.backdrop[0] - 1, JSON.stringify(pixels))
  } finally { await close() }
})

test('saved explicit and system modes draw the restored body on the first hydrated frame', async () => {
  for (const [mode, system, radius] of [['light', 'dark', 20], ['night', 'light', 18], ['auto', 'light', 20], ['auto', 'dark', 18]]) {
    const { page, close } = await open(mode, { system })
    try {
      const frames = await page.evaluate(() => window.skyFrames.map((frame) => frame.arcs.map((arc) => arc[2])))
      assert(frames.length > 0)
      assert(frames.every((arcs) => arcs.length && arcs.every((r) => r === radius)), `${mode}/${system}: ${JSON.stringify(frames)}`)
    } finally { await close() }
  }
  const { page, close } = await open('auto', { instant: '2026-09-12T19:00:00Z', route: '/tides/friday-harbor/' })
  try {
    await page.waitForFunction(() => window.skyFrames.at(-1).arcs.length === 1 && window.skyFrames.at(-1).arcs[0][2] === 20)
    const frames = await page.evaluate(() => window.skyFrames.map((frame) => frame.arcs.map((arc) => arc[2])))
    assert.deepEqual(frames[0], [])
    assert(frames.every((arcs) => !arcs.includes(18)))
    assert.deepEqual(frames.at(-1), [20])
  } finally { await close() }
})

test('saved location-based skies keep the sun on the shared arc from first paint', async () => {
  for (const [mode, route, observer] of [
    ['location', '/stations/', { latitude: 48.4284, longitude: -123.3656 }],
    ['auto', '/tides/friday-harbor/', undefined],
  ]) {
    const { page, close } = await open(mode, {
      observer, instant: '2026-09-12T19:00:00Z', route,
      viewport: { width: 390, height: 844 },
    })
    try {
      const { width, height, frames } = await page.evaluate(() => ({ width: innerWidth, height: innerHeight, frames: window.skyFrames.map((frame) => frame.arcs) }))
      assert.equal(frames[0].length, 0, `${mode} drew a placeholder body`)
      assert(frames.every((arcs) => arcs.every((arc) => arc[2] !== 18)), `${mode} flashed a placeholder moon`)
      const suns = frames.flatMap((arcs) => arcs.filter((arc) => arc[2] === 20))
      assert(suns.length > 0, `${mode} should draw the daytime sun`)
      const offArc = suns.find(([x, y]) => Math.abs(y - height * (0.016 * (2 * x / width - 1) ** 2 + 0.008 * x / width)) >= 1)
      assert.equal(offArc, undefined, `${mode} sun left the shared arc: ${JSON.stringify(offArc)}`)
      const overlap = await page.evaluate(() => {
        for (const frame of window.skyFrames) {
          for (const [x, y, radius] of frame.arcs.filter((arc) => arc[2] === 20)) {
            for (const label of document.querySelectorAll('main h1, main nav[aria-label="Breadcrumb"] a, main nav[aria-label="Breadcrumb"] li[aria-current]')) {
              const range = document.createRange()
              range.selectNodeContents(label)
              for (const rect of range.getClientRects()) {
                const dx = Math.max(rect.left - x, 0, x - rect.right)
                const dy = Math.max(rect.top - y, 0, y - rect.bottom)
                if (dx * dx + dy * dy < radius * radius) return { label: label.textContent, x, y, radius, rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } }
              }
            }
          }
        }
        return null
      })
      assert.equal(overlap, null, `${mode} sun overlaps ${JSON.stringify(overlap)}`)
    } finally { await close() }
  }
})

test('Auto follows Midland station time while Your location uses the visitor sky', async () => {
  const noon = '2026-09-12T19:00:00Z'
  const midnight = '2026-09-12T04:00:00Z'
  const day = await open('auto', { system: 'dark', instant: noon, route: '/tides/midland/' })
  try {
    assert.equal(await day.page.locator('html').getAttribute('data-appearance'), 'light')
    assert.match(await day.page.locator('[popoverTarget]').getAttribute('aria-label'), /Auto.*Light/)
    assert(await day.page.evaluate(() => window.skyFrames.at(-1).arcs.some((arc) => arc[2] === 20)))
    await day.page.locator('[popoverTarget]').click()
    assert.equal(await day.page.locator('label:has(input[value="auto"])').innerText(), 'Auto (station location)')
    assert.equal(await day.page.locator('label:has(input[value="location"])').innerText(), 'Your location')
  } finally { await day.close() }

  const night = await open('auto', { system: 'light', instant: midnight, route: '/tides/midland/' })
  try {
    assert.equal(await night.page.locator('html').getAttribute('data-appearance'), 'night')
  } finally { await night.close() }

  const shared = await open('auto', {
    system: 'dark', instant: midnight, route: '/tides/midland/2026-09-12T15:00-04:00',
  })
  try {
    assert.equal(await shared.page.locator('html').getAttribute('data-appearance'), 'light')
  } finally { await shared.close() }

  const visitor = await open('location', {
    system: 'light', instant: noon, route: '/tides/midland/',
    observer: { latitude: 35.6762, longitude: 139.6503 },
  })
  try {
    assert.equal(await visitor.page.locator('html').getAttribute('data-appearance'), 'night')
    assert.match(await visitor.page.locator('[popoverTarget]').getAttribute('aria-label'), /Your location.*Night/)
  } finally { await visitor.close() }
})

test('visible partial moons retain crescent, quarter, and gibbous phases', async () => {
  for (const [instant, fraction] of [
    ['2026-09-15T03:00:00Z', 0.1697],
    ['2026-09-04T09:00:00Z', 0.4958],
    ['2026-09-23T03:00:00Z', 0.8668],
  ]) {
    const { page, close } = await open('location', { instant, observer: { latitude: 48.4284, longitude: -123.3656 }, route: '/privacy/' })
    try {
      const pixels = await page.evaluate(() => {
        const frame = window.skyFrames.at(-1)
        const [x, y, radius] = frame.arcs.find((arc) => arc[2] === 18)
        const canvas = document.querySelector('canvas')
        const context = canvas.getContext('2d')
        const lit = (dx, dy) => {
          const px = Math.floor(x + dx * Math.cos(frame.angle) - dy * Math.sin(frame.angle))
          const py = Math.floor(y + dx * Math.sin(frame.angle) + dy * Math.cos(frame.angle))
          return py >= 0 && py < canvas.height ? context.getImageData(px, py, 1, 1).data[0] > 180 : null
        }
        let total = 0, illuminated = 0
        for (let dy = -radius; dy < radius; dy++) for (let dx = -radius; dx < radius; dx++) {
          if (dx * dx + dy * dy >= radius * radius) continue
          const bright = lit(dx, dy)
          if (bright === null) continue
          total++
          if (bright) illuminated++
        }
        return { fraction: illuminated / total, illuminated, shaded: total - illuminated }
      })
      console.log('MOON', instant, pixels)
      assert(pixels.illuminated > 0 && pixels.shaded > 0, JSON.stringify(pixels))
      assert(Math.abs(pixels.fraction - fraction) < 0.09, JSON.stringify(pixels))
    } finally { await close() }
  }
})

test('polar day and a circumpolar moon render above the horizon', async () => {
  for (const [instant, radius] of [['2026-06-21T12:00:00Z', 20], ['2026-12-22T00:00:00Z', 18]]) {
    const { page, close } = await open('location', { instant, observer: { latitude: 69.6492, longitude: 18.9553 }, route: '/privacy/' })
    try {
      const arcs = await page.evaluate(() => window.skyFrames.at(-1).arcs)
      assert(arcs.some(([x, y, r]) => r === radius && x > 0 && x < 1440 && y > 0 && y < 820), JSON.stringify(arcs))
      const pixel = await page.evaluate((radius) => {
        const [x, y] = window.skyFrames.at(-1).arcs.find((arc) => arc[2] === radius)
        return [...document.querySelector('canvas').getContext('2d').getImageData(Math.floor(x), Math.floor(y), 1, 1).data]
      }, radius)
      assert.deepEqual(pixel, radius === 20 ? [240, 200, 96, 255] : [228, 240, 228, 255])
      console.log('POLAR', instant, arcs[0], pixel)
    } finally { await close() }
  }
})
