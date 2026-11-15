import Link from 'next/link'
import { t } from '@/lib/i18n'
import { href } from '@/lib/routes'
import { ScreenHeader } from '@/shell/ScreenHeader'
import { button } from '@/shell/styles'

// A stop or line that does not exist: the 404 inside the app, tab bar included.
export default function NotFound() {
  const { notFound } = t('de')
  return (
    <>
      <ScreenHeader locale="de" title={notFound.title} />
      <main className="px-4">
        <p className="text-label-2">{notFound.text}</p>
        <Link href={href('de', 'route')} className={`${button.primary} mt-6`}>
          {notFound.home}
        </Link>
      </main>
    </>
  )
}
