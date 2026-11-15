import { de } from '@/messages/de'

const messages = { de }

export type Locale = keyof typeof messages
export type Messages = typeof de

export const t = (locale: Locale): Messages => messages[locale]
