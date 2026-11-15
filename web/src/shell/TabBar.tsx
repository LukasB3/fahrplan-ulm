'use client'

import { MotionConfig, motion } from 'motion/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Icon, type IconName } from './icons'

// `section` lists addresses outside the tab's own that still belong to it.
export type Tab = { href: string; label: string; icon: IconName; section?: string[] }

const under = (pathname: string, address: string) => pathname === address || pathname.startsWith(`${address}/`)

// A tab owns its own address, every page below it and its section; the start page owns only itself.
const tabOf = (tabs: Tab[], pathname: string) => tabs.find((tab) => (tab.href === '/' ? pathname === '/' : [tab.href, ...(tab.section ?? [])].some((address) => under(pathname, address))))?.href

export function TabBar({ tabs, label }: { tabs: Tab[]; label: string }) {
  const pathname = usePathname()
  // The selection moves with the tap, not when the next page has arrived.
  const [tap, setTap] = useState<{ from: string; to: string } | null>(null)
  const current = tap?.from === pathname ? tap.to : tabOf(tabs, pathname)

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
                  onClick={() => setTap({ from: pathname, to: tab.href })}
                  className={`pressable relative flex h-full flex-col items-center justify-center gap-0.5 ${active ? 'text-tint' : 'text-label-2'}`}
                >
                  <Icon name={tab.icon} active={active} />
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
