'use client'

import { Drawer } from '@base-ui/react/drawer'
import type { ReactElement, ReactNode } from 'react'

type Props = {
  // The button that opens the sheet. Without one, `open` decides.
  trigger?: ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
  title: ReactNode
  closeLabel: string
  // A passthrough sheet leaves the page behind it usable: no dimming, no focus trap.
  passthrough?: boolean
  // A low sheet covers at most the lower part of the screen, so what it belongs to stays in view.
  low?: boolean
  children: ReactNode
}

export function Sheet({ trigger, open, onOpenChange, title, closeLabel, passthrough = false, low = false, children }: Props) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} modal={!passthrough} disablePointerDismissal={passthrough}>
      {trigger && <Drawer.Trigger render={trigger} />}
      <Drawer.Portal>
        {!passthrough && <Drawer.Backdrop className="sheet-backdrop" />}
        <Drawer.Viewport className="sheet-viewport" data-passthrough={passthrough ? '' : undefined}>
          <Drawer.Popup className="sheet-popup" data-low={low ? '' : undefined}>
            <div aria-hidden className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-label-3" />
            <Drawer.Content className="px-4 pb-4">
              <div className="grid grid-cols-[1fr_auto] items-center gap-3 py-1">
                <Drawer.Title className="min-w-0 text-[1.0625rem] font-semibold">{title}</Drawer.Title>
                <Drawer.Close className="pressable -mr-2 flex h-11 items-center px-2 font-semibold text-tint">{closeLabel}</Drawer.Close>
              </div>
              {children}
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
