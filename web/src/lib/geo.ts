const EARTH_RADIUS_M = 6_371_000
const radians = (degrees: number) => (degrees * Math.PI) / 180

export type Position = { lat: number; lon: number }

// Why the phone's position could not be had: the person, the browser or the
// phone's settings said no; or no position was found in time.
export type LocateProblem = 'denied' | 'unavailable'

// Where the phone is. Asked for precisely first; indoors that can take longer
// than anyone waits, so a failure or a timeout is followed by the rough position
// from the networks around, which comes at once and is enough to find a stop nearby.
export const locate = (): Promise<Position> =>
  new Promise((resolve, reject: (problem: LocateProblem) => void) => {
    if (!('geolocation' in navigator)) return reject('unavailable')
    const ask = (precise: boolean) =>
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => resolve({ lat: coords.latitude, lon: coords.longitude }),
        (error) => (error.code === error.PERMISSION_DENIED ? reject('denied') : precise ? ask(false) : reject('unavailable')),
        precise ? { enableHighAccuracy: true, timeout: 8_000, maximumAge: 60_000 } : { enableHighAccuracy: false, timeout: 12_000, maximumAge: 300_000 },
      )
    ask(true)
  })

export const metresBetween = (a: Position, b: Position) => {
  const dLat = radians(b.lat - a.lat)
  const dLon = radians(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}
