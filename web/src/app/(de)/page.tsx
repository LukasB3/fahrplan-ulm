import { href } from '@/lib/routes'
import { pageMetadata } from '@/lib/seo'
import { RouteScreen } from '@/screens/TabScreens'

export const metadata = pageMetadata(href('de', 'route'))

export default function Page() {
  return <RouteScreen locale="de" />
}
