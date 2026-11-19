import type { ReactNode } from 'react'

export type IconName = 'route' | 'departures' | 'map' | 'alerts' | 'info' | 'chevron' | 'back' | 'mic' | 'location' | 'search' | 'star' | 'clear' | 'walk' | 'swap' | 'pin' | 'recent' | 'stop' | 'send' | 'sparkle'

// Closed shapes get a soft fill when the icon is active, as in a selected tab.
const shapes: Record<IconName, (fill: string) => ReactNode> = {
  route: (fill) => (
    <>
      <circle cx="6" cy="19" r="2.5" fill={fill} />
      <circle cx="18" cy="5" r="2.5" fill={fill} />
      <path d="M8.5 19H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5" />
    </>
  ),
  departures: (fill) => (
    <>
      <circle cx="12" cy="12" r="9" fill={fill} />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  map: (fill) => (
    <>
      <path d="M9 4 3.5 6.5V20L9 17.5l6 2.5 5.5-2.5V4L15 6.5 9 4Z" fill={fill} />
      <path d="M9 4v13.5M15 6.5V20" />
    </>
  ),
  alerts: (fill) => (
    <>
      <path d="M12 3.5 2.5 20h19L12 3.5Z" fill={fill} />
      <path d="M12 10v4.5M12 17.2v.1" />
    </>
  ),
  info: () => (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5M12 7.7v.1" />
    </>
  ),
  chevron: () => <path d="m9 5 7 7-7 7" />,
  back: () => <path d="m15 5-7 7 7 7" />,
  search: () => (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </>
  ),
  star: (fill) => <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8L3.5 9.7l5.9-.8L12 3.5Z" fill={fill} />,
  clear: () => (
    <>
      <circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" />
      <path d="m9 9 6 6m0-6-6 6" stroke="var(--surface)" />
    </>
  ),
  mic: (fill) => (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" fill={fill} />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </>
  ),
  location: (fill) => <path d="M20 4 3.5 11l7 2.5L13 20.5 20 4Z" fill={fill} />,
  walk: () => (
    <>
      <circle cx="13" cy="4.5" r="1.7" fill="currentColor" stroke="none" />
      <path d="m9 21 2.5-6.5-2-2.5 1.5-4 3 2.5 3 1M8 10.5l2.5-2M13 13l2.5 3 1 5" />
    </>
  ),
  swap: () => <path d="M7.5 4v15m0 0-3.5-3.5M7.5 19l3.5-3.5M16.5 20V5m0 0L13 8.5M16.5 5 20 8.5" />,
  pin: (fill) => (
    <>
      <path d="M12 21s6.5-5.6 6.5-10.5a6.5 6.5 0 0 0-13 0C5.500 15.4 12 21 12 21Z" fill={fill} />
      <circle cx="12" cy="10.5" r="2.2" />
    </>
  ),
  stop: (fill) => (
    <>
      <circle cx="12" cy="12" r="9" fill={fill} />
      <path d="M9 8v8m6-8v8m-6-4h6" />
    </>
  ),
  send: () => <path d="M12 19V5m0 0-6 6m6-6 6 6" />,
  sparkle: (fill) => (
    <>
      <path d="M10 4c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5C7.8 9.9 9.4 8.3 10 4Z" fill={fill} />
      <path d="M18.5 14.5c.3 1.7.8 2.2 2.5 2.5-1.7.3-2.2.8-2.5 2.5-.3-1.7-.8-2.2-2.5-2.5 1.7-.3 2.2-.8 2.5-2.5Z" />
    </>
  ),
  recent: () => (
    <>
      <path d="M4 12a8 8 0 1 0 2.6-5.9L4 8.5M4 4.5v4h4" />
      <path d="M12 8v4.2l2.8 1.6" />
    </>
  ),
}

export function Icon({ name, active = false, className }: { name: IconName; active?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {shapes[name](active ? (name === 'star' ? 'currentColor' : 'color-mix(in srgb, currentColor 18%, transparent)') : 'none')}
    </svg>
  )
}
