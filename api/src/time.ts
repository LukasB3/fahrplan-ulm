const berlin = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' })

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// A moment as the wall clock and calendar in Ulm show it. `weekday` counts from Sunday, 0.
export const berlinParts = (moment: Date) => {
  const part = Object.fromEntries(berlin.formatToParts(moment).map(({ type, value }) => [type, value]))
  return { year: Number(part.year), month: Number(part.month), day: Number(part.day), hour: Number(part.hour), minute: Number(part.minute), weekday: WEEKDAYS.indexOf(part.weekday!) }
}

const two = (value: number) => String(value).padStart(2, '0')

// A moment in the form DING's planner takes: date YYYYMMDD, time HHMM, both by the clock in Ulm.
export const berlinClock = (moment: Date) => {
  const { year, month, day, hour, minute } = berlinParts(moment)
  return { date: `${year}${two(month)}${two(day)}`, time: `${two(hour)}${two(minute)}` }
}

// The moment at which the clock in Ulm shows this date and time. Days past
// the end of the month roll over, so "tomorrow" is simply day + 1.
export const berlinMoment = (year: number, month: number, day: number, hour: number, minute: number) => {
  const asIfUtc = Date.UTC(year, month - 1, day, hour, minute)
  const ahead = (utc: number) => {
    const shown = berlinParts(new Date(utc))
    return Date.UTC(shown.year, shown.month - 1, shown.day, shown.hour, shown.minute) - utc
  }
  // The second pass settles the hour on the two days a year the clocks change.
  return new Date(asIfUtc - ahead(asIfUtc - ahead(asIfUtc)))
}
