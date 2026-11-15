'use client'

import { useSyncExternalStore } from 'react'

// A small still map of a walk: a few map tiles with the way drawn on top.
// No map library: the tiles are plain images, placed by the usual web
// mercator arithmetic.
const TILE = 256
const WIDTH = 360
const HEIGHT = 200
const MARGIN = 30
// Closer than this, a short walk fills the map and the streets around it are lost.
const CLOSEST_ZOOM = 17
const WIDEST_ZOOM = 12

const project = (lat: number, lon: number, zoom: number) => {
  const world = TILE * 2 ** zoom
  const x = ((lon + 180) / 360) * world
  const y = ((1 - Math.asinh(Math.tan((lat * Math.PI) / 180)) / Math.PI) / 2) * world
  return [x, y] as const
}

const dark = '(prefers-color-scheme: dark)'
const subscribeToScheme = (listener: () => void) => {
  const query = matchMedia(dark)
  query.addEventListener('change', listener)
  return () => query.removeEventListener('change', listener)
}

type Props = { path: [lat: number, lon: number][]; label: string; credit: string }

export function WalkMap({ path, label, credit }: Props) {
  const isDark = useSyncExternalStore(
    subscribeToScheme,
    () => matchMedia(dark).matches,
    () => false,
  )
  if (path.length < 2) return null

  // The closest zoom at which the whole way fits, with room around it.
  let zoom = CLOSEST_ZOOM
  let points = path.map(([lat, lon]) => project(lat, lon, zoom))
  const extent = (of: typeof points) => {
    const xs = of.map(([x]) => x)
    const ys = of.map(([, y]) => y)
    return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) }
  }
  let box = extent(points)
  while (zoom > WIDEST_ZOOM && (box.right - box.left > WIDTH - 2 * MARGIN || box.bottom - box.top > HEIGHT - 2 * MARGIN)) {
    zoom--
    points = path.map(([lat, lon]) => project(lat, lon, zoom))
    box = extent(points)
  }

  const left = (box.left + box.right) / 2 - WIDTH / 2
  const top = (box.top + box.bottom) / 2 - HEIGHT / 2
  const columns = Array.from({ length: Math.floor((left + WIDTH) / TILE) - Math.floor(left / TILE) + 1 }, (_, index) => Math.floor(left / TILE) + index)
  const rows = Array.from({ length: Math.floor((top + HEIGHT) / TILE) - Math.floor(top / TILE) + 1 }, (_, index) => Math.floor(top / TILE) + index)
  const style = isDark ? 'alidade_smooth_dark' : 'alidade_smooth'
  const way = points.map(([x, y]) => `${(x - left).toFixed(1)},${(y - top).toFixed(1)}`).join(' ')
  const [startX, startY] = points[0]!
  const [endX, endY] = points.at(-1)!

  return (
    <figure className="overflow-hidden rounded-2xl bg-fill">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} className="block w-full">
        {rows.flatMap((row) => columns.map((column) => <image key={`${column} ${row}`} href={`https://tiles.stadiamaps.com/tiles/${style}/${zoom}/${column}/${row}@2x.png`} x={column * TILE - left} y={row * TILE - top} width={TILE} height={TILE} />))}
        {/* A white casing keeps the dotted way readable on any ground. */}
        <polyline points={way} fill="none" stroke="var(--surface)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
        <polyline points={way} fill="none" stroke="var(--tint)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="0.1 8" />
        <circle cx={startX - left} cy={startY - top} r="6" fill="var(--surface)" stroke="var(--tint)" strokeWidth="3" />
        <circle cx={endX - left} cy={endY - top} r="7" fill="var(--tint)" stroke="var(--surface)" strokeWidth="3" />
      </svg>
      <figcaption className="px-2 py-1 text-right text-[0.625rem] text-label-2">{credit}</figcaption>
    </figure>
  )
}
