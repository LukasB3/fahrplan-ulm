'use client'

import { usePathname } from 'next/navigation'
import { useLayoutEffect } from 'react'
import { visit } from './trail'

// Tells the trail which page is on screen. `root` marks a tab's main page.
export function Visit({ label, root = false }: { label: string; root?: boolean }) {
  const path = usePathname()
  // Before the page is painted, so the back link and the tab bar never show what belonged to the page before.
  useLayoutEffect(() => visit({ path, label, root }), [path, label, root])
  return null
}
