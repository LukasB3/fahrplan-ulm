'use client'

import { MotionConfig, motion } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode, useState } from 'react'
import { Icon, type IconName } from './icons'
import { type Trail, useTrail } from './trail'

// `section` lists addresses outside the tab's own that still belong to it.
export type Tab = { href: string; label: string; icon: IconName; section?: string[]; badge?: ReactNode }

const under = (pathname: string, address: string) => pathname === address || pathname.startsWith(`${address}/`)

// A tab owns its own address, every page below it and its section; the start page's own address is only itself.
const tabOf = (tabs: Tab[], pathname: string) => tabs.find((tab) => [tab.href, ...(tab.section ?? [])].some((address) => (address === '/' ? pathname === '/' : under(pathname, address))))?.href

export function TabBar({ tabs, label }: { tabs: Tab[]; label: string }) {
  const pathname = usePathname()
  const trail = useTrail()
  // The selection moves with the tap, not when the next page has arrived. The tap counts until another page is on screen.
  const [tap, setTap] = useState<{ on: Trail | null; to: string } | null>(null)
  // Otherwise the tab is the one the walk started in: a stop opened from the map stays in the map's tab.
  const current = tap && tap.on === trail ? tap.to : tabOf(tabs, trail?.root ?? pathname)

  return (
    <nav aria-label={label} className="tabbar material">
      <MotionConfig reducedMotion="user">
        <ul className="grid h-full auto-cols-fr grid-flow-col">
          {tabs.map((tab) => {
            const active = tab.href === current
            return (
              <li key={tab.href} className="relative">
                {active && <motion.span layoutId="tab-selection" className="absolute inset-1 rounded-full bg-fill" transition={{ type: 'spring', bounce: 0, duration: 0.35 }} />}
                <Link
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  onNavigate={() => setTap({ on: trail, to: tab.href })}
                  className={`pressable relative flex h-full flex-col items-center justify-center gap-0.5 ${active ? 'text-tint' : 'text-label-2'}`}
                >
                  <Icon name={tab.icon} active={active} />
                  {tab.badge}
                  <span className="text-[0.6875rem] leading-none font-semibold">{tab.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </MotionConfig>
    </nav>
  )
}
