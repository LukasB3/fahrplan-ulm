'use client'

import { Drawer } from '@base-ui/react/drawer'
import type { ReactElement, ReactNode } from 'react'

type Props = {
  // The button that opens the sheet.
  trigger: ReactElement
  title: string
  closeLabel: string
  // A passthrough sheet leaves the page behind it usable: no dimming, no focus trap.
  passthrough?: boolean
  children: ReactNode
}

export function Sheet({ trigger, title, closeLabel, passthrough = false, children }: Props) {
  return (
    <Drawer.Root modal={!passthrough} disablePointerDismissal={passthrough}>
      <Drawer.Trigger render={trigger} />
      <Drawer.Portal>
        {!passthrough && <Drawer.Backdrop className="sheet-backdrop" />}
        <Drawer.Viewport className="sheet-viewport" data-passthrough={passthrough ? '' : undefined}>
          <Drawer.Popup className="sheet-popup">
            <div aria-hidden className="mx-auto mt-2 h-[5px] w-9 rounded-full bg-label-3" />
            <Drawer.Content className="px-4 pb-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center py-1">
                <Drawer.Title className="col-start-2 text-[1.0625rem] font-semibold">{title}</Drawer.Title>
                <Drawer.Close className="pressable -mr-2 flex h-11 items-center justify-self-end px-2 font-semibold text-tint">{closeLabel}</Drawer.Close>
              </div>
              {children}
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
