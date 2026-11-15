// The app's mark: the yellow disc with a green H that stands at every German
// bus stop. Drawn from plain shapes so it renders the same in the page and in
// the generated icon images, which have no bold font to draw the letter with.
const GREEN = '#0b6b3a'
const YELLOW = '#ffd400'

export function Mark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512">
      <rect width="512" height="512" fill={GREEN} />
      <circle cx="256" cy="256" r="170" fill={YELLOW} />
      <circle cx="256" cy="256" r="148" fill="none" stroke={GREEN} strokeWidth="14" />
      <rect x="196" y="176" width="30" height="160" fill={GREEN} />
      <rect x="286" y="176" width="30" height="160" fill={GREEN} />
      <rect x="226" y="241" width="60" height="30" fill={GREEN} />
    </svg>
  )
}
