import type { Metadata } from 'next'
import { href } from '@/lib/routes'
import { pageMetadata } from '@/lib/seo'
import { PrivacyScreen, legalTitles } from '@/screens/LegalScreens'

// The legal pages are for visitors, not for search results.
export const metadata: Metadata = { ...pageMetadata(href('de', 'privacy'), legalTitles('de').privacy), robots: { index: false } }

export default function Page() {
  return <PrivacyScreen locale="de" />
}
