import type { Metadata } from 'next'
import { href } from '@/lib/routes'
import { pageMetadata } from '@/lib/seo'
import { ImprintScreen, legalTitles } from '@/screens/LegalScreens'

// The legal pages are for visitors, not for search results.
export const metadata: Metadata = { ...pageMetadata(href('de', 'imprint'), legalTitles('de').imprint), robots: { index: false } }

export default function Page() {
  return <ImprintScreen locale="de" />
}
