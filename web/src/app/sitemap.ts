import type { MetadataRoute } from 'next'
import { lines, stops } from '@/lib/data'
import { href, lineHref, stopHref } from '@/lib/routes'
import { SITE_ORIGIN } from '@/lib/seo'

// Every page a searcher could want.
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    href('de', 'route'),
    href('de', 'departures'),
    href('de', 'alerts'),
    href('de', 'map'),
    href('de', 'stops'),
    href('de', 'lines'),
    ...lines.map((line) => lineHref('de', line.id)),
    ...stops.map((stop) => stopHref('de', stop.slug)),
  ]
  return paths.map((path) => ({ url: `${SITE_ORIGIN}${path === '/' ? '' : path}` }))
}
