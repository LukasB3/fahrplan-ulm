'use client'

import { toggleFavourite, useFavourites } from '@/lib/store'
import { Icon } from '@/shell/icons'

export function FavouriteButton({ code, labels }: { code: string; labels: { add: string; remove: string } }) {
  const favourite = useFavourites().includes(code)
  return (
    <button type="button" aria-pressed={favourite} aria-label={favourite ? labels.remove : labels.add} onClick={() => toggleFavourite(code)} className="pressable grid size-11 place-items-center text-tint">
      <Icon name="star" active={favourite} />
    </button>
  )
}
