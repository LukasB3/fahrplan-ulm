import { stops } from '@/lib/data'
import { t } from '@/lib/i18n'
import { href } from '@/lib/routes'
import { pageMetadata } from '@/lib/seo'
import { StopsHubScreen } from '@/screens/HubScreens'

const { hubs } = t('de')
export const metadata = pageMetadata(href('de', 'stops'), hubs.stopsTitle, hubs.stopsDescription(stops.length))

export default function Page() {
  return <StopsHubScreen locale="de" />
}
