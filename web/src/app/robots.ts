import type { MetadataRoute } from 'next'
import { href } from '@/lib/routes'
import { SITE_ORIGIN } from '@/lib/seo'

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: href('de', 'lab') }, sitemap: `${SITE_ORIGIN}/sitemap.xml` }
}
