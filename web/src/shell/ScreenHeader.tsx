import type { ReactNode } from 'react'
import { t, type Locale } from '@/lib/i18n'
import { BackLink } from './BackLink'
import { InfoButton } from './InfoButton'
import { Visit } from './Visit'

type Props = {
  locale: Locale
  title: string
  // A tab's main page: nothing leads back from it.
  root?: boolean
  // What a back link to this page says, where the title is not it.
  crumb?: string
  // Where a page below a tab leads back to when it was not opened from another page.
  back?: { href: string; label: string }
  // A button that belongs to this page, shown next to the info button.
  actions?: ReactNode
}

// The first line of the large title is shorter than the others. A compound too
// long for it may break before its last part ("Schwarzenberg-straße") rather
// than anywhere; the break point only shows where it is used.
const breakable = (title: string) => title.replace(/\p{L}{15,}/gu, (word) => word.replace(/(?<=\p{L}{4})(?=(?:straße|weg|platz|kaserne|brücke|gasse|allee)$)/u, '\u00AD'))

// The large title scrolls away with the page; the bar above it stays, and
// shows the title small once the large one is gone. The buttons sit on the
// large title's line while the page is at its top and in the bar once it is
// scrolled (see globals.css).
export function ScreenHeader({ locale, title, root = false, crumb, back, actions }: Props) {
  const { header } = t(locale)
  return (
    <>
      <Visit label={crumb ?? title} root={root} />
      <header className="navbar">
        <div aria-hidden className="navbar-material material absolute inset-0 border-b border-separator" />
        <p aria-hidden className={`navbar-title pointer-events-none absolute bottom-0 flex h-11 items-center justify-center font-semibold ${root ? 'inset-x-14' : 'inset-x-28'}`}>
          <span className="truncate">{title}</span>
        </p>
        {!root && <BackLink parent={back} title={title} backLabel={header.back} />}
      </header>
      <div className="navbar-actions">
        {actions}
        <InfoButton locale={locale} />
      </div>
      {/* Only the title's first line is shortened for the buttons: a float of one line's height. */}
      <h1 className={`px-4 pb-3 text-[2.125rem] leading-[1.2] font-bold tracking-[-0.022em] [overflow-wrap:anywhere] before:float-right before:h-[1lh] before:content-[''] ${actions ? 'before:w-20' : 'before:w-9'}`}>{breakable(title)}</h1>
    </>
  )
}
