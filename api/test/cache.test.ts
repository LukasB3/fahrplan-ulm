import { describe, expect, it } from 'vitest'
import { cached } from '../src/cache.js'

const source = (answers: (string | Error)[]) => {
  let calls = 0
  const load = () => {
    const answer = answers[Math.min(calls++, answers.length - 1)]!
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer)
  }
  return { load, calls: () => calls }
}

describe('cached', () => {
  it('asks the source once while the answer is fresh', async () => {
    const { load, calls } = source(['a', 'b'])
    const get = cached(load, { freshMs: 1_000, staleMs: 10_000 })
    expect(await get('k')).toEqual({ value: 'a', stale: false })
    expect(await get('k')).toEqual({ value: 'a', stale: false })
    expect(calls()).toBe(1)
  })

  it('asks again once the answer is old', async () => {
    const { load } = source(['a', 'b'])
    const get = cached(load, { freshMs: 1_000, staleMs: 10_000 })
    await get('k')
    expect(await get('k', Date.now() + 2_000)).toEqual({ value: 'b', stale: false })
  })

  it('shares one request between callers arriving together', async () => {
    const { load, calls } = source(['a'])
    const get = cached(load, { freshMs: 1_000, staleMs: 10_000 })
    await Promise.all([get('k'), get('k'), get('k')])
    expect(calls()).toBe(1)
  })

  it('serves the last answer, marked stale, when the source fails', async () => {
    const { load } = source(['a', new Error('down')])
    const get = cached(load, { freshMs: 1_000, staleMs: 10_000 })
    await get('k')
    expect(await get('k', Date.now() + 2_000)).toEqual({ value: 'a', stale: true })
  })

  it('fails when the source fails and there is nothing to fall back on', async () => {
    const { load } = source([new Error('down')])
    const get = cached(load, { freshMs: 1_000, staleMs: 10_000 })
    await expect(get('k')).rejects.toThrow('down')
  })

  it('forgets the oldest key beyond its size', async () => {
    const { load, calls } = source(['a'])
    const get = cached(load, { freshMs: 1_000, staleMs: 10_000, max: 2 })
    await get('one')
    await get('two')
    await get('three')
    await get('one')
    expect(calls()).toBe(4)
  })
})
