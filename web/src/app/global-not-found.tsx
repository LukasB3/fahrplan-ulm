import './globals.css'
import type { Metadata } from 'next'
import { t } from '@/lib/i18n'
import { href } from '@/lib/routes'
import { siteViewport } from '@/lib/seo'
import { button } from '@/shell/styles'

// Addresses that match no page end here, outside both language layouts.
const { notFound, site } = t('de')

export const metadata: Metadata = { title: `${notFound.title} · ${site.name}`, robots: { index: false } }
export const viewport = siteViewport

export default function GlobalNotFound() {
  return (
    <html lang="de">
      <body>
        <main className="grid min-h-[70dvh] place-items-center px-6 text-center">
          <div>
            <h1 className="text-[2.125rem] leading-[1.2] font-bold tracking-[-0.022em]">{notFound.title}</h1>
            <p className="mt-2 text-label-2">{notFound.text}</p>
            <a href={href('de', 'route')} className={`${button.primary} mt-6`}>
              {notFound.home}
            </a>
          </div>
        </main>
      </body>
    </html>
  )
}
