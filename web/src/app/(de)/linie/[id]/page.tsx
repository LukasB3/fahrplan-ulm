import { notFound } from 'next/navigation'
import { lineBySlug, lines } from '@/lib/data'
import { t } from '@/lib/i18n'
import { lineHref } from '@/lib/routes'
import { pageMetadata } from '@/lib/seo'
import { LineScreen } from '@/screens/LineScreen'

type Props = { params: Promise<{ id: string }> }

export const dynamicParams = false
export const generateStaticParams = () => lines.map((line) => ({ id: line.id.toLowerCase() }))

export async function generateMetadata({ params }: Props) {
  const line = lineBySlug((await params).id)
  if (!line) return {}
  const { line: copy } = t('de')
  const stops = new Set(line.directions.flatMap((direction) => direction.stops)).size
  return pageMetadata(lineHref('de', line.id), { absolute: copy.title(line.id, line.name) }, copy.description(line.id, copy.kinds[line.kind], line.name, stops))
}

export default async function Page({ params }: Props) {
  const line = lineBySlug((await params).id)
  if (!line) notFound()
  return <LineScreen locale="de" line={line} />
}
