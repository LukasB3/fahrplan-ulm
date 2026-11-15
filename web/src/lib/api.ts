export const API_ORIGIN = process.env.NEXT_PUBLIC_API_ORIGIN ?? (process.env.NODE_ENV === 'production' ? 'https://api.fahrplan-ulm.de' : 'http://localhost:8787')

export const getJson = async <T>(path: string, signal?: AbortSignal): Promise<T> => {
  const res = await fetch(`${API_ORIGIN}${path}`, { signal })
  if (!res.ok) throw new Error(`${path} answered ${res.status}`)
  return (await res.json()) as T
}

export const postJson = async <T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> => {
  const res = await fetch(`${API_ORIGIN}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal })
  if (!res.ok) throw new Error(`${path} answered ${res.status}`)
  return (await res.json()) as T
}
