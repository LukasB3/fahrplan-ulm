import type { Locale } from './i18n'

// Every page has one address per language. Links are built from here only.
const paths = {
  route: { de: '/' },
  departures: { de: '/abfahrten' },
  map: { de: '/karte' },
  alerts: { de: '/meldungen' },
  stops: { de: '/haltestellen' },
  stop: { de: '/haltestelle' },
  lines: { de: '/linien' },
  line: { de: '/linie' },
  imprint: { de: '/impressum' },
  privacy: { de: '/datenschutz' },
  lab: { de: '/labor' },
} as const

export type RouteName = keyof typeof paths

export const href = (locale: Locale, route: Exclude<RouteName, 'stop' | 'line'>): string => paths[route][locale]
export const stopHref = (locale: Locale, slug: string) => `${paths.stop[locale]}/${slug}`
export const lineHref = (locale: Locale, id: string) => `${paths.line[locale]}/${id.toLowerCase()}`

// The pages that belong to the departures tab without living under its address.
export const departuresSection = (locale: Locale) => [paths.stops[locale], paths.stop[locale], paths.lines[locale], paths.line[locale]]
