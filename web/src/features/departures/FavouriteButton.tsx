'use client'

import { type Favourite, toggleFavourite, useFavourites } from '@/lib/store'
import { Icon } from '@/shell/icons'

export function FavouriteButton({ stop, labels }: { stop: Favourite; labels: { add: string; remove: string } }) {
  const favourite = useFavourites().some((other) => other.code === stop.code)
  return (
    <button type="button" aria-pressed={favourite} aria-label={favourite ? labels.remove : labels.add} onClick={() => toggleFavourite(stop)} className="pressable grid size-11 place-items-center text-tint">
      <Icon name="star" active={favourite} />
    </button>
  )
}
