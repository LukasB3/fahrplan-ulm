const berlin = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

// A moment as the wall clock in Ulm shows it, in the form DING's planner takes: date YYYYMMDD, time HHMM.
export const berlinClock = (moment: Date) => {
  const part = Object.fromEntries(berlin.formatToParts(moment).map(({ type, value }) => [type, value]))
  return { date: `${part.year}${part.month}${part.day}`, time: `${part.hour}${part.minute}` }
}
