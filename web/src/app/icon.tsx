import { ImageResponse } from 'next/og'
import { Mark } from '@/shell/Mark'

const SIZES = [32, 192, 512]

// The two large sizes are what the manifest offers for the home screen.
export function generateImageMetadata() {
  return SIZES.map((size) => ({ id: String(size), size: { width: size, height: size }, contentType: 'image/png' }))
}

export default async function Icon({ id }: { id: Promise<string> }) {
  const size = Number(await id)
  return new ImageResponse(<Mark size={size} />, { width: size, height: size })
}
