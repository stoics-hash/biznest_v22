import { createContext, useContext } from 'react'
import type { CityResponse } from '@networking/api/model/cityResponse'

export interface CityData {
  selectedCity: CityResponse | null
  selectCity: (city: CityResponse) => void
  clearCity: () => void
}

export const CityContext = createContext<CityData>({
  selectedCity: null,
  selectCity: () => {},
  clearCity: () => {},
})

export const useCityContext = () => useContext(CityContext)
