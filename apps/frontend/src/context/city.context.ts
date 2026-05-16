import { createContext, useContext } from 'react'
import type { CityResponse } from '@networking/api/model/cityResponse'
import type { BoundaryGeometry } from '@/engine/map.engine'

export interface CityData {
  selectedCity: CityResponse | null
  cityId: string | null
  cityBoundary: BoundaryGeometry | null
  selectCity: (cityId: string) => Promise<void>
  clearCity: () => void
}

export const CityContext = createContext<CityData>({
  selectedCity: null,
  cityId: null,
  cityBoundary: null,
  selectCity: async () => {},
  clearCity: () => {},
})

export const useCityContext = () => useContext(CityContext)