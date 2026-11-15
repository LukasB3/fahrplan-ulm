import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { alertBoard } from '../src/alerts.js'
import { efaAlerts } from '../src/efa.js'
import { paragraphs, tidy } from '../src/text.js'
import type { GetJson } from '../src/upstream.js'

const fixture = (name: string): unknown => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8'))
const answering = (answer: unknown): GetJson => () => Promise.resolve(answer)

describe('a notice as plain text', () => {
  it('turns markup into paragraphs and bullets, and entities into letters', () => {
    const html = '<div>An der Haltestelle bestehen Einschr&auml;nkungen.&nbsp;<br /><br />Ab dem 01.08. gilt:</div>\n<ul>\n<li>Steig B wird bedient.&nbsp;</li>\n<li>Linie 4 f&auml;hrt von Steig&nbsp;D.<br /><br /></li>\n</ul>'
    expect(paragraphs(html)).toEqual(['An der Haltestelle bestehen Einschränkungen.', 'Ab dem 01.08. gilt:', '• Steig B wird bedient.', '• Linie 4 fährt von Steig D.'])
  })

  it('lets no markup through', () => {
    expect(paragraphs('<img src=x onerror=alert(1)>Umleitung<script>alert(2)</script> &#8211; &lt;b&gt;heute&lt;/b&gt;').join(' ')).toBe('Umleitungalert(2) – <b>heute</b>')
  })

  it('tidies the spacing editors leave behind', () => {
    expect(tidy('Haltestellen Ludwigsfeld, Danziger Straße     , \t\t\tLudwigsfeld, Hafnerweg \tund Oberfeld: Haltausfälle')).toBe('Haltestellen Ludwigsfeld, Danziger Straße, Ludwigsfeld, Hafnerweg und Oberfeld: Haltausfälle')
  })
})

describe('alerts, as recorded', () => {
  it("keep the notices about SWU's lines and drop the rest of the state", async () => {
    const alerts = await efaAlerts(answering(fixture('efa-alerts')), 'https://efa.example')
    expect(alerts.map((alert) => alert.lines)).toEqual([['5'], ['1'], ['10']])
  })

  it('carry title, text, stops and how long they apply', async () => {
    const [stopsClosed, , line] = await efaAlerts(answering(fixture('efa-alerts')), 'https://efa.example')
    expect(stopsClosed).toMatchObject({ id: 'ems-1013531', from: '2026-07-07T22:00:00Z', to: null, published: '2026-07-08T09:23:00Z' })
    expect(stopsClosed!.title).toBe('Haltestellen Ludwigsfeld, Danziger Straße, Ludwigsfeld, Reichenberger Straße, Ludwigsfeld, Hafnerweg, Ludwigsfeld, Allgäuer Straße und Ludwigsfeld, Oberfeld: Haltausfälle wegen Bauarbeiten')
    expect(stopsClosed!.stops).toContain('de:09775:1772')
    expect(line).toMatchObject({ title: 'Linie 10: Kürzung bei Stau bis auf Weiteres', stops: [] })
    expect(line!.text[0]).toMatch(/^Derzeit kommt es vermehrt zu PKW-Rückstau in der Blaubeurer Straße\./)
    expect(line!.text.join(' ')).not.toMatch(/[<>]|&[a-z]+;/)
  })
})

describe('the alert board', () => {
  const NOW = Date.parse('2026-11-15T12:00:00Z')
  const notice = (id: string, from: string | null, to: string | null, created: string) => ({
    id,
    timestamps: { creation: created, validity: [{ from, to }] },
    affected: { lines: [{ number: '5', operator: { name: 'SWU' } }], stops: [] },
    infoLinks: [{ urlText: `Meldung ${id}`, content: 'Text' }],
  })
  const board = (current: unknown[]) => {
    let asked = 0
    const getJson: GetJson = () => {
      asked++
      return Promise.resolve({ infos: { current } })
    }
    return { alerts: alertBoard({ getJson, efaBase: 'https://efa.example' }), asked: () => asked }
  }

  it('shows what applies now first, then what is to come, the newest notice first, and nothing that is over', async () => {
    const { alerts } = board([
      notice('old', '2026-01-01T00:00:00Z', '2026-12-31T00:00:00Z', '2026-01-01T00:00:00Z'),
      notice('tomorrow', '2026-11-16T03:00:00Z', null, '2026-11-14T00:00:00Z'),
      notice('new', '2026-11-10T00:00:00Z', null, '2026-11-09T00:00:00Z'),
      notice('over', '2026-01-01T00:00:00Z', '2026-11-01T00:00:00Z', '2026-01-01T00:00:00Z'),
    ])
    expect((await alerts(NOW)).alerts.map((alert) => alert.id)).toEqual(['new', 'old', 'tomorrow'])
  })

  it('asks DING once in five minutes', async () => {
    const { alerts, asked } = board([])
    await alerts(NOW)
    await alerts(NOW + 4 * 60_000)
    expect(asked()).toBe(1)
  })
})
