import type { LineStyle } from '@/lib/data-types'

// A line's number in its colour. Trams are square, buses round, and lines of
// other operators (regional buses, trains), which have no colour here, grey.
export function LineBadge({ line, style, small = false }: { line: string; style?: LineStyle; small?: boolean }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center px-1.5 leading-none font-bold whitespace-nowrap tabular-nums ${small ? 'h-5 min-w-5 text-[0.75rem]' : 'h-6 min-w-7 text-[0.875rem]'} ${style?.tram ? 'rounded-[0.3rem]' : 'rounded-full'} ${style ? '' : 'bg-fill-strong text-label'}`}
      style={style && { backgroundColor: style.color, color: style.textColor }}
    >
      {line}
    </span>
  )
}
