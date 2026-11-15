// Notices arrive as text or as HTML from an editor: divs, line breaks,
// lists, entities. They are shown as plain paragraphs, so no markup of
// theirs ever reaches a page.

const ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  auml: 'ä', ouml: 'ö', uuml: 'ü', Auml: 'Ä', Ouml: 'Ö', Uuml: 'Ü', szlig: 'ß',
  eacute: 'é', egrave: 'è', agrave: 'à', ccedil: 'ç',
  ldquo: '“', rdquo: '”', bdquo: '„', lsquo: '‘', rsquo: '’', sbquo: '‚', laquo: '«', raquo: '»',
  ndash: '–', mdash: '—', hellip: '…', bull: '•', middot: '·', euro: '€', sect: '§', deg: '°', shy: '',
}

const decode = (text: string) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] !== '#') return ENTITIES[name] ?? whole
    const code = name[1]!.toLowerCase() === 'x' ? Number.parseInt(name.slice(2), 16) : Number(name.slice(1))
    return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : ''
  })

export const tidy = (text: string) => text.replace(/\s+/g, ' ').replace(/ ([,.:;])/g, '$1').trim()

// The paragraphs of a notice. List items start with a bullet.
export const paragraphs = (notice: string) =>
  decode(
    notice
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<br\s*\/?>|<\/(div|p|li|ul|ol|h\d|tr)>/gi, '\n')
      .replace(/<[^>]*>/g, ''),
  )
    .split('\n')
    .map(tidy)
    .filter((line) => line && line !== '•')
