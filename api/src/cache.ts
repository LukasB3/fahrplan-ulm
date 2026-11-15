type Entry<T> = { at: number; value: T }

export type Cached<T> = { value: T; stale: boolean }

// Remembers answers of a slow or rate-limited source. Within `freshMs` the
// source is not asked again, callers arriving together share one request, and
// when the source fails its last answer is served for up to `staleMs`.
export const cached = <T>(load: (key: string) => Promise<T>, { freshMs, staleMs, max = 2_000 }: { freshMs: number; staleMs: number; max?: number }) => {
  const entries = new Map<string, Entry<T>>()
  const loading = new Map<string, Promise<Cached<T>>>()

  return (key: string, now = Date.now()): Promise<Cached<T>> => {
    const entry = entries.get(key)
    if (entry && now - entry.at < freshMs) return Promise.resolve({ value: entry.value, stale: false })
    const running = loading.get(key)
    if (running) return running

    const request = load(key)
      .then((value): Cached<T> => {
        // Re-inserting keeps the map in order of last refresh, so the first key is the oldest.
        entries.delete(key)
        entries.set(key, { at: Date.now(), value })
        if (entries.size > max) entries.delete(entries.keys().next().value!)
        return { value, stale: false }
      })
      .catch((error: unknown): Cached<T> => {
        if (entry && Date.now() - entry.at < staleMs) return { value: entry.value, stale: true }
        throw error
      })
      .finally(() => loading.delete(key))
    loading.set(key, request)
    return request
  }
}
