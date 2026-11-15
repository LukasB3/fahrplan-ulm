import type { DayType, Grid, LineStyle, TimetableTable } from '@/lib/data-types'
import { Icon } from '@/shell/icons'
import { LineBadge } from '@/shell/LineBadge'

export type TimetableLabels = { towards: string; hour: string; days: Record<DayType, string>; firstLast: (first: string, last: string) => string }

const DAY_ORDER: DayType[] = ['mofr', 'moth', 'fr', 'sa', 'su']
const two = (value: number) => String(value).padStart(2, '0')
// Hours count on past 24 for trips after midnight; on paper they read 0, 1, 2.
const clockOf = (hour: number, minute: number) => `${two(hour % 24)}:${two(minute)}`

const span = (grid: Grid) => {
  const [first, last] = [grid[0]!, grid.at(-1)!]
  return [clockOf(first[0], first[1][0]!), clockOf(last[0], last[1].at(-1)!)] as const
}

// One line and direction at a stop, as on the printed timetable: a row per
// hour, a column per day type, the minutes in the cells. Closed until tapped,
// but part of the page either way.
export function Timetable({ table, style, labels }: { table: TimetableTable; style?: LineStyle; labels: TimetableLabels }) {
  const days = DAY_ORDER.filter((day) => table.days[day])
  const hours = [...new Set(days.flatMap((day) => table.days[day]!.map(([hour]) => hour)))].sort((a, b) => a - b)
  const minutesAt = (day: DayType, hour: number) => table.days[day]!.find(([gridHour]) => gridHour === hour)?.[1] ?? []
  const usual = table.days[days[0]!]!

  return (
    <details className="group border-t border-separator first:border-t-0">
      <summary className="pressable flex min-h-[3.75rem] cursor-pointer list-none items-center gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden">
        <span className="flex w-14 shrink-0">
          <LineBadge line={table.line} style={style} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate">
            <span className="sr-only">{labels.towards} </span>
            {table.headsign}
          </span>
          <span className="block truncate text-[0.8125rem] text-label-2 tabular-nums">
            {labels.days[days[0]!]} {labels.firstLast(...span(usual))}
          </span>
        </span>
        <Icon name="chevron" className="size-4 shrink-0 text-label-3 transition-transform group-open:rotate-90 motion-reduce:transition-none" />
      </summary>
      <div className="overflow-x-auto px-4 pb-4">
        <table className="w-full border-collapse text-[0.8125rem] tabular-nums">
          <thead>
            <tr className="text-left text-label-2">
              <th scope="col" className="w-8 py-1.5 pr-2 font-semibold">
                {labels.hour}
              </th>
              {days.map((day) => (
                <th key={day} scope="col" className="py-1.5 pr-2 font-semibold">
                  {labels.days[day]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {hours.map((hour) => (
              <tr key={hour} className="border-t border-separator align-top">
                <th scope="row" className="py-1.5 pr-2 text-left font-semibold">
                  {two(hour % 24)}
                </th>
                {days.map((day) => (
                  <td key={day} className="py-1.5 pr-2">
                    {minutesAt(day, hour).map(two).join(' ')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}
