'use client'

import Link from 'next/link'
import { Icon } from './icons'
import { Sheet } from './Sheet'

type Props = {
  labels: { open: string; title: string; close: string; about: string; unofficial: string }
  links: { href: string; label: string }[]
}

export function InfoSheet({ labels, links }: Props) {
  return (
    <Sheet
      title={labels.title}
      closeLabel={labels.close}
      trigger={
        <button type="button" aria-label={labels.open} className="pressable grid size-11 place-items-center text-tint">
          <Icon name="info" />
        </button>
      }
    >
      <p className="mt-2 text-label-2">
        {labels.about} {labels.unofficial}
      </p>
      <ul className="mt-4 overflow-hidden rounded-card bg-bg">
        {links.map((link, index) => (
          <li key={link.href} className={index > 0 ? 'border-t border-separator' : undefined}>
            <Link href={link.href} className="pressable flex min-h-11 items-center justify-between px-4 py-2.5">
              {link.label}
              <Icon name="chevron" className="size-4 text-label-3" />
            </Link>
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
