import { t, type Locale } from '@/lib/i18n'
import { href } from '@/lib/routes'
import { InfoSheet } from './InfoSheet'

// The button that opens "about this app", with the links to the legal pages.
export function InfoButton({ locale }: { locale: Locale }) {
  const { info, site } = t(locale)
  return (
    <InfoSheet
      labels={{ open: info.open, title: info.title, close: info.close, about: info.about, unofficial: site.unofficial }}
      links={[
        { href: href(locale, 'imprint'), label: info.imprint },
        { href: href(locale, 'privacy'), label: info.privacy },
      ]}
    />
  )
}
