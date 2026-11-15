// Colours as "#rrggbb".
const channels = (colour: string) => [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16))

const luminance = (colour: string) => {
  const [red, green, blue] = channels(colour).map((value) => (value / 255 <= 0.03928 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4)) as [number, number, number]
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

// How well one colour stands out from another, from 1 (not at all) to 21, as WCAG measures it.
export const contrast = (a: string, b: string) => {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (lighter + 0.05) / (darker + 0.05)
}

// The colour with each channel scaled by `factor`, below 1 for darker.
export const shaded = (colour: string, factor: number) => `#${channels(colour).map((value) => Math.round(value * factor).toString(16).padStart(2, '0')).join('')}`
