// "Söflingen" is found by "soflingen" and "Straße" by "strasse".
export const plain = (text: string) =>
  text
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')

// How well a name answers what was typed: names starting with it first, then
// names with a word starting with it, then names containing it. Both sides are plain text.
export const matchRank = (name: string, query: string) => (name.startsWith(query) ? 0 : name.split(/[\s\-/.]+/).some((word) => word.startsWith(query)) ? 1 : name.includes(query) ? 2 : undefined)
