import { t } from '@/lib/i18n'
import { href } from '@/lib/routes'
import { pageMetadata } from '@/lib/seo'
import { LinesHubScreen } from '@/screens/HubScreens'

const { hubs } = t('de')
export const metadata = pageMetadata(href('de', 'lines'), hubs.linesTitle, hubs.linesDescription)

export default function Page() {
  return <LinesHubScreen locale="de" />
}
