'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from './icons'
import { useTrail } from './trail'

type Props = {
  // Where the page leads back to when it was not opened from another page: a landing from a search engine, a reload.
  parent?: { href: string; label: string }
  // The page's own title, which shares the bar with the link once the page is scrolled.
  title: string
  backLabel: string
}

const style = 'pressable relative flex h-11 items-center pr-2 text-tint'

// A name of up to ten letters fits beside any title, a longer one only beside a short title.
const fits = (label: string, title: string) => label.length <= 10 || label.length + title.length <= 23

// Leads back to the page this one was opened from.
export function BackLink({ parent, title, backLabel }: Props) {
  const path = usePathname()
  const trail = useTrail()
  // The trail speaks for this page only once the page has been counted.
  const back = trail?.path === path ? trail.back : null

  if (back)
    return (
      <Link
        href={back.path}
        prefetch={false}
        // That page is the history entry before this one: going back keeps its scroll position, and the link does what the swipe does.
        onNavigate={(event) => {
          event.preventDefault()
          window.history.back()
        }}
        className={style}
      >
        <Icon name="back" />
        {fits(back.label, title) ? back.label : backLabel}
      </Link>
    )
  if (!parent) return <span />
  return (
    <Link href={parent.href} className={style}>
      <Icon name="back" />
      {parent.label}
    </Link>
  )
}
