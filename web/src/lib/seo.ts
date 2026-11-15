import type { Metadata, Viewport } from 'next'
import { t, type Locale } from './i18n'

export const SITE_ORIGIN = 'https://fahrplan-ulm.de'

export const siteMetadata = (locale: Locale): Metadata => {
  const { site } = t(locale)
  return {
    metadataBase: new URL(SITE_ORIGIN),
    title: { default: site.title, template: `%s · ${site.name}` },
    description: site.description,
    applicationName: site.name,
    appleWebApp: { capable: true, title: site.name, statusBarStyle: 'default' },
    formatDetection: { telephone: false },
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

// For pages that exist but have nothing for a searcher yet.
export const notIndexed = { index: false, follow: true }

// A page's own metadata: every page names its one address, so copies under
// other addresses (www, query strings) count for it.
export const pageMetadata = (path: string, title?: Metadata['title'], description?: string): Metadata => ({ title, description, alternates: { canonical: path } })
