import { cached } from './cache.js'
import type { StopDirectory } from './stops.js'
import { swuVehicles, swuVehicleTrip } from './swu.js'
import type { Vehicles, VehicleTrip } from './types.js'
import type { GetJson } from './upstream.js'

// Where SWU's vehicles are. SWU renews the positions every 15 seconds, so
// however many maps are open, SWU is asked at most every ten.
export const vehicleBoard = ({ getJson, stops }: { getJson: GetJson; stops: Pick<StopDirectory, 'lineOf'> }) => {
  const positions = cached(() => swuVehicles(getJson, stops.lineOf), { freshMs: 10_000, staleMs: 60_000, max: 1 })
  const trips = cached((vehicle) => swuVehicleTrip(getJson, Number(vehicle)), { freshMs: 10_000, staleMs: 0, max: 300 })
  return {
    all: async (): Promise<Vehicles> => ({ now: new Date().toISOString(), vehicles: (await positions('all')).value }),
    trip: async (vehicle: number): Promise<VehicleTrip> => (await trips(String(vehicle))).value,
  }
}

export type VehicleBoard = ReturnType<typeof vehicleBoard>
