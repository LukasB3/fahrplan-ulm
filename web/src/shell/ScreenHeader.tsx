import Link from 'next/link'
import type { ReactNode } from 'react'
import type { Locale } from '@/lib/i18n'
import { Icon } from './icons'
import { AccountButton } from '@/features/account/AccountButton'

type Props = {
  locale: Locale
  title: string
  // Where a page below a tab leads back to.
  back?: { href: string; label: string }
  // Buttons that belong to this page, shown next to the account button.
  actions?: ReactNode
}

// The large title scrolls away with the page; the bar above it stays, and
// shows the title small once the large one is gone (see globals.css).
export function ScreenHeader({ locale, title, back, actions }: Props) {
  return (
    <>
      <header className="navbar">
        <div aria-hidden className="navbar-material material absolute inset-0 border-b border-separator" />
        <p aria-hidden className={`navbar-title pointer-events-none absolute bottom-0 flex h-11 items-center justify-center font-semibold ${back ? 'inset-x-28' : 'inset-x-14'}`}>
          <span className="truncate">{title}</span>
        </p>
        {back ? (
          <Link href={back.href} className="pressable relative flex h-11 items-center pr-2 text-tint">
            <Icon name="back" />
            {back.label}
          </Link>
        ) : (
          <span />
        )}
        <div className="relative flex items-center">
          {actions}
          <AccountButton locale={locale} />
        </div>
      </header>
      <h1 className="px-4 pb-3 text-[2.125rem] leading-[1.2] font-bold tracking-[-0.022em] [overflow-wrap:anywhere]">{title}</h1>
    </>
  )
}
