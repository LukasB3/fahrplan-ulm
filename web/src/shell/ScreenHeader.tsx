import { t, type Locale } from '@/lib/i18n'
import { href } from '@/lib/routes'
import { InfoSheet } from './InfoSheet'

// The large title scrolls away with the page; the bar above it stays, and
// shows the title small once the large one is gone (see globals.css).
export function ScreenHeader({ locale, title }: { locale: Locale; title: string }) {
  const { info, site } = t(locale)
  return (
    <>
      <header className="navbar">
        <div aria-hidden className="navbar-material material absolute inset-0 border-b border-separator" />
        <p aria-hidden className="navbar-title pointer-events-none absolute inset-x-14 bottom-0 flex h-11 items-center justify-center truncate font-semibold">
          {title}
        </p>
        <div className="relative">
          <InfoSheet
            labels={{ open: info.open, title: info.title, close: info.close, about: info.about, unofficial: site.unofficial }}
            links={[
              { href: href(locale, 'imprint'), label: info.imprint },
              { href: href(locale, 'privacy'), label: info.privacy },
            ]}
          />
        </div>
      </header>
      <h1 className="px-4 pb-3 text-[2.125rem] leading-[1.2] font-bold tracking-[-0.022em]">{title}</h1>
    </>
  )
}
