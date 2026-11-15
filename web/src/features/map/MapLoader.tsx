'use client'

import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'

// The map library is large and draws only in a browser: it is fetched when
// the map tab is opened, and no other page pays for it.
const LiveMap = dynamic(() => import('./LiveMap'), { ssr: false, loading: () => <div className="map-host" aria-busy /> })

export function MapLoader(props: ComponentProps<typeof LiveMap>) {
  return <LiveMap {...props} />
}
