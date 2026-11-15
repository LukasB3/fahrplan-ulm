import { t, type Locale } from '@/lib/i18n'
import { href } from '@/lib/routes'
import { AccountSheet } from './AccountSheet'

// The button top right. It opens the account, and what this app is.
export function AccountButton({ locale }: { locale: Locale }) {
  const { account, site } = t(locale)
  return <AccountSheet labels={{ ...account, about: `${account.about} ${site.unofficial}` }} imprintHref={href(locale, 'imprint')} privacyHref={href(locale, 'privacy')} />
}
