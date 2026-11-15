import { asFavourites, favourites, isPlace, mirrored, places, unsent, type Change } from '@/lib/store'
import { SUPABASE_KEY, SUPABASE_URL } from './config'
import { accountExists, currentLogin, dropLogin, endLogin } from './session'

// The account's favourites, home and work live in two tables at Supabase,
// which the browser reads and writes directly with the login. The database
// lets a login see its own rows only (infra/supabase-setup.sql).
type Rest = (path: string, init?: RequestInit) => Promise<Response>

const restAs =
  (token: string): Rest =>
  (path, init) =>
    fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${token}`, 'content-type': 'application/json', ...init?.headers } })

// Writes the row, or over the one that is there.
const put = (body: unknown): RequestInit => ({ method: 'POST', headers: { prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(body) })

const send = (rest: Rest, change: Change) =>
  change.kind === 'favourite'
    ? rest('favorite_stops?on_conflict=user_id,stop_code', put({ stop_code: change.stop.code, dhid: change.stop.dhid, lines: change.stop.lines, added_at: new Date(change.at).toISOString() }))
    : change.kind === 'unfavourite'
      ? rest(`favorite_stops?stop_code=eq.${encodeURIComponent(change.code)}`, { method: 'DELETE' })
      : rest('saved_places?on_conflict=user_id,slot', put({ slot: change.as, place: change.place }))

const rows = async (rest: Rest, path: string) => {
  const res = await rest(path)
  if (!res.ok) throw new Error(`${path} answered ${res.status}`)
  const body: unknown = await res.json()
  return Array.isArray(body) ? (body as unknown[]) : []
}

// What the account holds, newest favourite first as on the device.
const held = async (rest: Rest) => {
  const [stops, saved] = await Promise.all([rows(rest, 'favorite_stops?select=code:stop_code,dhid,lines&order=added_at.desc'), rows(rest, 'saved_places?select=slot,place')])
  const place = (slot: 'home' | 'work') => {
    const found = (saved as { slot?: unknown; place?: unknown }[]).find((row) => row?.slot === slot)?.place
    return isPlace(found) ? found : undefined
  }
  return { stops: asFavourites(stops), home: place('home'), work: place('work') }
}

const settle = <T>(store: { read: () => T; write: (next: T) => void }, next: T) => {
  if (JSON.stringify(store.read()) !== JSON.stringify(next)) store.write(next)
}

// The device keeps its favourites and places; it only stops following an account.
const part = () => {
  mirrored.write(null)
  unsent.write([])
}

const run = async () => {
  const login = await currentLogin()
  if (!login) return
  const rest = restAs(login.token)

  if (mirrored.read() !== login.account) {
    // The first time this device meets the account: what the device has and
    // the account lacks goes up, so nothing is lost on either side. A home or
    // work the account already has stays.
    const theirs = await held(rest)
    const now = Date.now()
    const mine = favourites
      .read()
      .filter((stop) => !theirs.stops.some((other) => other.code === stop.code))
      .reverse()
    const saved = places.read()
    unsent.write([
      // Oldest first, so the newest ends up on top as it is here.
      ...mine.map((stop, index): Change => ({ kind: 'favourite', stop, at: now - mine.length + index })),
      ...(['home', 'work'] as const).flatMap((as): Change[] => {
        const place = saved[as]
        return place && !theirs[as] ? [{ kind: 'place', as, place, at: now }] : []
      }),
    ])
    mirrored.write(login.account)
  }

  for (let next = unsent.read()[0]; next; next = unsent.read()[0]) {
    const res = await send(rest, next)
    // A server in trouble or a login that needs renewing may take it later.
    // Anything else is settled: taken, or refused for good.
    if (res.status >= 500 || res.status === 401 || res.status === 429) return
    const sent = JSON.stringify(next)
    unsent.write(unsent.read().filter((change) => JSON.stringify(change) !== sent))
  }

  const theirs = await held(rest)
  const has = { ...places.read(), stops: favourites.read() }
  const empties = !theirs.stops.length && !theirs.home && !theirs.work && (has.stops.length > 0 || has.home || has.work)
  // An account deleted on another device looks empty for as long as this
  // login lasts. The device then keeps what it has and forgets the login.
  if (empties && !(await accountExists())) {
    part()
    return dropLogin()
  }
  // Something changed here while the account answered: that goes up first.
  if (unsent.read().length) return void sync()
  settle(favourites, theirs.stops)
  settle(places, { ...places.read(), home: theirs.home, work: theirs.work })
}

let running: Promise<void> | undefined
let again = false

// Brings the device and the account to the same favourites, home and work:
// first what changed here goes up, then the device takes over what the
// account holds. Without a login it does nothing. Failing is fine: what was
// not sent stays noted, and the next call tries again.
export const sync = (): Promise<void> => {
  if (running) {
    again = true
    return running
  }
  running = run()
    .catch(() => {})
    .finally(() => {
      running = undefined
      if (again) {
        again = false
        void sync()
      }
    })
  return running
}

export const logOut = async () => {
  if (await endLogin()) return false
  part()
  return true
}

// Removes the account with everything in it. The device keeps its copy.
export const deleteAccount = async () => {
  const login = await currentLogin()
  const res = login && (await restAs(login.token)('rpc/delete_account', { method: 'POST' }).catch(() => null))
  if (!res?.ok) return false
  part()
  await dropLogin()
  return true
}
