import type { ReactNode } from 'react'

export type IconName = 'route' | 'departures' | 'map' | 'alerts' | 'info' | 'chevron' | 'mic' | 'location'

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
  mic: (fill) => (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" fill={fill} />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </>
  ),
  location: (fill) => <path d="M20 4 3.5 11l7 2.5L13 20.5 20 4Z" fill={fill} />,
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
      {shapes[name](active ? 'color-mix(in srgb, currentColor 18%, transparent)' : 'none')}
    </svg>
  )
}
