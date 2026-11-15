import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { matchRank, searchable } from './search'

// The real stops, busiest first, as the pages get them.
const stops = (JSON.parse(readFileSync(new URL('../../data/stops.json', import.meta.url), 'utf8')) as { name: string; town: string; weight: number }[]).sort((a, b) => b.weight - a.weight)
const index = stops.map((stop) => searchable(stop.name, stop.town))

const found = (query: string) =>
  stops
    .map((stop, at) => ({ stop, rank: matchRank(index[at]!, query) }))
    .filter((match) => match.rank !== undefined)
    .sort((a, b) => a.rank! - b.rank!)
    .map((match) => match.stop.name)

test('a stop is found with its town in front or behind', () => {
  assert.equal(found('Ulm Hauptbahnhof')[0], 'Hauptbahnhof')
  assert.equal(found('hauptbahnhof ulm')[0], 'Hauptbahnhof')
  assert.equal(found('Neu-Ulm ZUP')[0], 'ZUP')
  assert.equal(found('zup neu ulm')[0], 'ZUP')
})

test('a stop is not found under another town', () => {
  assert.ok(!found('Neu-Ulm Hauptbahnhof').includes('Hauptbahnhof'))
})

test('what people write for a station is understood', () => {
  assert.equal(found('hbf')[0], 'Hauptbahnhof')
  assert.equal(found('Ulm Hbf')[0], 'Hauptbahnhof')
})

test('a slip of the finger still finds the stop', () => {
  assert.equal(found('Hauptbanhof')[0], 'Hauptbahnhof')
  assert.equal(found('ehinger thor')[0], 'Ehinger Tor')
  assert.equal(found('Sofligen')[0], 'Söflingen')
  assert.equal(found('Thaeter')[0], 'Theater')
})

test('words may be shortened and written without accents', () => {
  assert.equal(found('uni süd')[0], 'Universität Süd')
  assert.equal(found('soflingen')[0], 'Söflingen')
  assert.equal(found('virchowstr')[0], 'Virchowstraße')
})

test('a name beginning with what was typed comes before one that only contains it', () => {
  const rathaus = found('rat')
  assert.ok(rathaus[0]!.toLowerCase().startsWith('rat'))
  const first = rathaus.findIndex((name) => !name.toLowerCase().startsWith('rat'))
  assert.ok(first === -1 || rathaus.slice(first).every((name) => !name.toLowerCase().startsWith('rat')))
})

test('a town alone lists its stops, those carrying it in their name first', () => {
  const neuUlm = found('neu-ulm')
  assert.ok(neuUlm.length >= stops.filter((stop) => stop.town === 'Neu-Ulm').length)
  assert.ok(neuUlm.includes('ZUP'))
})

test('nonsense finds nothing', () => {
  assert.deepEqual(found('xyzqw'), [])
  assert.deepEqual(found('   '), [])
})
