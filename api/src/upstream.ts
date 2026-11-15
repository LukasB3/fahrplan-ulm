// How the transport operators' servers are asked. They see who is asking.
export type GetJson = (url: string) => Promise<unknown>

const USER_AGENT = 'fahrplan-ulm.de (+https://fahrplan-ulm.de)'

export const getJson: GetJson = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': USER_AGENT, accept: 'application/json' }, signal: AbortSignal.timeout(8_000) })
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}`)
  return res.json()
}

// The stop that was asked for does not exist at the operator.
export class UnknownStop extends Error {}
