import type { Locale } from './i18n'

// Every page has one address per language. Links are built from here only.
const paths = {
  route: { de: '/' },
  departures: { de: '/abfahrten' },
  map: { de: '/karte' },
  alerts: { de: '/meldungen' },
  imprint: { de: '/impressum' },
  privacy: { de: '/datenschutz' },
  lab: { de: '/labor' },
} as const

export type RouteName = keyof typeof paths

export const href = (locale: Locale, route: RouteName): string => paths[route][locale]
