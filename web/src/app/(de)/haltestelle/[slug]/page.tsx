import { notFound } from 'next/navigation'
import { stopBySlug, stops } from '@/lib/data'
import { t } from '@/lib/i18n'
import { stopHref } from '@/lib/routes'
import { pageMetadata } from '@/lib/seo'
import { StopScreen } from '@/screens/StopScreen'

type Props = { params: Promise<{ slug: string }> }

// Every stop has its page built ahead; any other address is a 404.
export const dynamicParams = false
export const generateStaticParams = () => stops.map((stop) => ({ slug: stop.slug }))

export async function generateMetadata({ params }: Props) {
  const stop = stopBySlug((await params).slug)
  if (!stop) return {}
  const { stop: copy } = t('de')
  return pageMetadata(stopHref('de', stop.slug), copy.title(stop.name, stop.town), copy.description(stop.name, stop.town, stop.lines.join(', ')))
}

export default async function Page({ params }: Props) {
  const stop = stopBySlug((await params).slug)
  if (!stop) notFound()
  return <StopScreen locale="de" stop={stop} />
}
