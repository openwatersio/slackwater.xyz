import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { EventCard, relativeEventDay } from './UpcomingEvents'
import { EVENTS } from '#/lib/water-events'
import { upcomingEvents } from '#/lib/discovery'

const seattle = EVENTS.find((event) => event.id === 'seattle-2026-11-27')!

describe('upcoming event cards', () => {
  it('makes the entire concise card a link and explains the high tide', () => {
    const html = renderToStaticMarkup(<EventCard event={seattle} now={Date.parse('2026-11-26T20:00:00Z')} />)
    expect(html).toContain('Tomorrow')
    expect(html).toContain('12.7 ft')
    expect(html).toContain('1.3 ft above the average daily high tide')
    expect(html).toContain('Friday, November 27, 2026 at 7:39 AM PST')
    expect(html).toContain('selected by Slackwater from NOAA predictions')
    expect(html).toMatch(/^<a [\s\S]*<\/a>$/)
    expect(html).not.toContain('View and share')
    expect(html).not.toContain('National Weather Service')
  })

  it('does not feature the current without a meaningful comparison', () => {
    const cards = upcomingEvents(EVENTS, Date.parse('2026-11-26T20:00:00Z')).filter((event) => event.highlight)
    expect(cards.map((event) => event.id)).not.toContain('deception-pass-2026-11-27')
    expect(EVENTS.find((event) => event.id === 'deception-pass-2026-11-27')).toBeDefined()
  })

  it('uses the event station’s calendar day, including daylight saving changes', () => {
    expect(relativeEventDay(new Date('2026-11-27T15:39:00Z'), Date.parse('2026-11-27T07:30:00Z'), 'America/Los_Angeles')).toBe('Tomorrow')
    expect(relativeEventDay(new Date('2026-11-27T15:39:00Z'), Date.parse('2026-11-27T08:30:00Z'), 'America/Los_Angeles')).toBe('Today')
    expect(relativeEventDay(new Date('2027-01-25T15:16:00Z'), Date.parse('2026-11-26T20:00:00Z'), 'America/Los_Angeles')).toBe('In 60 days')
  })
})
