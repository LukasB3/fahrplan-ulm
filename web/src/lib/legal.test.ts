import assert from 'node:assert/strict'
import { test } from 'node:test'
import { askSectionId, legalDe, type Block, type Inline, type LegalDoc } from '../messages/legal.de'

const docs: Record<'imprint' | 'privacy', LegalDoc> = legalDe

const parts = (block: Block): Inline[] => (typeof block === 'string' ? [block] : Array.isArray(block) ? block : block.list.flatMap(parts))
const ids = (doc: LegalDoc) => doc.sections.map((section) => section.id)

test('every section of a legal page has an id of its own', () => {
  for (const doc of Object.values(docs)) {
    assert.equal(new Set(ids(doc)).size, ids(doc).length)
    for (const id of ids(doc)) assert.match(id, /^[a-z][a-z-]*$/)
  }
})

test('a link into a legal page leads to a section that exists', () => {
  for (const doc of Object.values(docs))
    for (const section of doc.sections)
      for (const part of section.body.flatMap(parts)) if (typeof part !== 'string' && 'route' in part && part.hash) assert.ok(ids(docs[part.route]).includes(part.hash), `${section.id} links to #${part.hash}`)
})

test('the sentence field links to a section of the privacy page', () => {
  assert.ok(ids(docs.privacy).includes(askSectionId))
})

test('the legal notice leads to the privacy page', () => {
  const pointer = docs.imprint.sections.find((section) => section.id === 'privacy')
  assert.ok(pointer?.body.flatMap(parts).some((part) => typeof part !== 'string' && 'route' in part && part.route === 'privacy'))
})
