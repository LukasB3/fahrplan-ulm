const EARTH_RADIUS_M = 6_371_000
const radians = (degrees: number) => (degrees * Math.PI) / 180

type Position = { lat: number; lon: number }

export const metresBetween = (a: Position, b: Position) => {
  const dLat = radians(b.lat - a.lat)
  const dLon = radians(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radians(a.lat)) * Math.cos(radians(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h))
}
