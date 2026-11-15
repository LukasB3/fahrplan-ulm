// "Söflingen" is found by "soflingen" and "Straße" by "strasse".
export const plain = (text: string) =>
  text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

const words = (text: string) => plain(text).split(/[\s\-/.,()]+/).filter(Boolean)

// What people type for what is written on the sign.
const SHORT: Record<string, string> = { hbf: 'hauptbahnhof', bhf: 'bahnhof', bf: 'bahnhof' }

// A stop made ready for searching, once: its name as plain text and in words, and the words of its town.
export type Searchable = { name: string; words: string[]; town: string[] }

export const searchable = (name: string, town: string): Searchable => ({ name: plain(name), words: words(name), town: words(town) })

// How many letters have to be changed, added, dropped or swapped with their neighbour to turn one word into the other.
const distance = (a: string, b: string) => {
  let twoBack: number[] = []
  let before = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    for (let j = 1; j <= b.length; j++) {
      const same = a[i - 1] === b[j - 1]
      row[j] = Math.min(before[j]! + 1, row[j - 1]! + 1, before[j - 1]! + (same ? 0 : 1))
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) row[j] = Math.min(row[j]!, twoBack[j - 2]! + 1)
    }
    twoBack = before
    before = row
  }
  return before[b.length]!
}

// A slip of the finger: one wrong letter in a word of four or more, two from eight on.
// The word may still be unfinished, so it is held against the beginning of the name's word.
const SLIP_FROM = 4
const TWO_SLIPS_FROM = 8
const near = (typed: string, word: string) => {
  if (typed.length < SLIP_FROM) return false
  const allowed = typed.length >= TWO_SLIPS_FROM ? 2 : 1
  for (let length = typed.length - 1; length <= typed.length + 1; length++) if (length > 0 && distance(typed, word.slice(0, length)) <= allowed) return true
  return false
}

const WHOLE = 0
const WORD = 1
const INSIDE = 2
const SLIP = 3
const TOWN_ONLY = 9

// How well a stop answers what was typed, lower being better; nothing if it does not.
// A name starting with what was typed comes first. Otherwise every word typed has
// to be found: as the beginning of a word of the name, inside the name, as a slip
// of one of its words, or as the stop's town ("Ulm Hauptbahnhof"). The weakest word decides.
export const matchRank = (stop: Searchable, query: string): number | undefined => {
  const typed = plain(query.trim())
  if (!typed) return undefined
  if (stop.name.startsWith(typed)) return WHOLE

  let rank: number | undefined
  for (const word of words(query)) {
    const wanted = SHORT[word] ?? word
    const found = stop.words.some((own) => own.startsWith(wanted))
      ? WORD
      : stop.name.includes(wanted)
        ? INSIDE
        : stop.words.some((own) => near(wanted, own))
          ? SLIP
          : stop.town.some((own) => own.startsWith(word))
            ? undefined
            : null
    if (found === null) return undefined
    if (found !== undefined) rank = Math.max(rank ?? WORD, found)
  }
  // Only the town was typed: its stops, after any stop that carries the town in its name.
  return rank ?? TOWN_ONLY
}
