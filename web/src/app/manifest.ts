import type { MetadataRoute } from 'next'
import { t } from '@/lib/i18n'

export default function manifest(): MetadataRoute.Manifest {
  const { site } = t('de')
  return {
    name: site.name,
    short_name: site.name,
    description: site.description,
    lang: 'de',
    start_url: '/',
    display: 'standalone',
    background_color: '#f2f2f7',
    theme_color: '#f2f2f7',
    icons: [192, 512].flatMap((size) =>
      (['any', 'maskable'] as const).map((purpose) => ({ src: `/icon/${size}`, sizes: `${size}x${size}`, type: 'image/png', purpose })),
    ),
  }
}
