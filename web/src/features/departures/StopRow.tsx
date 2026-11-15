import Link from 'next/link'
import type { LineStyle } from '@/lib/data-types'
import { Icon } from '@/shell/icons'
import { LineBadge } from '@/shell/LineBadge'

// The city everyone means. Its name is not repeated in every row.
export const HOME_TOWN = 'Ulm'

// What a list needs to know about a stop. `town` is left out for the city everyone means.
export type ListedStop = { code: string; href: string; name: string; town: string | null; lines: string[]; lat: number; lon: number }

type Props = { stop: ListedStop; lineStyles: Record<string, LineStyle>; note?: string; prefetch?: boolean }

export function StopRow({ stop, lineStyles, note, prefetch }: Props) {
  return (
    <li className="border-t border-separator first:border-t-0">
      <Link href={stop.href} prefetch={prefetch} className="pressable flex min-h-[3.75rem] items-center gap-3 px-4 py-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate">
            {stop.name}
            {stop.town && <span className="text-label-2"> · {stop.town}</span>}
          </span>
          <span className="mt-1 flex flex-wrap gap-1">
            {stop.lines.map((line) => (
              <LineBadge key={line} line={line} style={lineStyles[line]} small />
            ))}
          </span>
        </span>
        {note && <span className="shrink-0 text-[0.9375rem] text-label-2 tabular-nums">{note}</span>}
        <Icon name="chevron" className="size-4 shrink-0 text-label-3" />
      </Link>
    </li>
  )
}
