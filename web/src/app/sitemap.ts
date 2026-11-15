import type { MetadataRoute } from 'next'
import { lines, stops } from '@/lib/data'
import { href, lineHref, stopHref } from '@/lib/routes'
import { SITE_ORIGIN } from '@/lib/seo'

// Every page a searcher could want. The tabs still under construction are left out.
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    href('de', 'route'),
    href('de', 'departures'),
    href('de', 'stops'),
    href('de', 'lines'),
    ...lines.map((line) => lineHref('de', line.id)),
    ...stops.map((stop) => stopHref('de', stop.slug)),
  ]
  return paths.map((path) => ({ url: `${SITE_ORIGIN}${path === '/' ? '' : path}` }))
}
