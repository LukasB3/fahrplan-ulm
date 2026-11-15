import type { Metadata, Viewport } from 'next'
import { t, type Locale } from './i18n'

export const SITE_ORIGIN = 'https://fahrplan-ulm.de'

// The site is under construction: nothing is offered to search engines yet.
const INDEXABLE = false

export const siteMetadata = (locale: Locale): Metadata => {
  const { site } = t(locale)
  return {
    metadataBase: new URL(SITE_ORIGIN),
    title: { default: site.title, template: `%s · ${site.name}` },
    description: site.description,
    applicationName: site.name,
    appleWebApp: { capable: true, title: site.name, statusBarStyle: 'default' },
    formatDetection: { telephone: false },
    robots: INDEXABLE ? undefined : { index: false, follow: false },
  }
}

export const siteViewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The page draws under the notch and the home indicator and pads for them itself.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f2f2f7' },
    { media: '(prefers-color-scheme: dark)', color: '#000000' },
  ],
}

export const robotsRules = INDEXABLE ? { userAgent: '*', allow: '/' } : { userAgent: '*', disallow: '/' }
