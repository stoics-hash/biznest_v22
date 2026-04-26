import { useState, useEffect, type PropsWithChildren } from 'react'
import type { CityResponse } from '@networking/api/model/cityResponse'
import { useAuthContext } from '@/context/auth.context'
import { CityContext, type CityData } from '@/context/city.context'

const STORAGE_KEY = 'biznest:selected_city'

function readStoredCity(): CityResponse | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as CityResponse) : null
  } catch {
    return null
  }
}

export function CityProvider({ children }: PropsWithChildren) {
  const { state } = useAuthContext()
  const cityIds = state.state === 'AUTHENTICATED' ? state.city_ids : []

  const [selectedCity, setSelectedCity] = useState<CityResponse | null>(readStoredCity)

  // If the persisted city is no longer in the user's accessible set, clear it
  useEffect(() => {
    if (selectedCity && cityIds.length > 0 && !cityIds.includes(selectedCity.id)) {
      setSelectedCity(null)
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [cityIds, selectedCity])

  // Clear on sign-out
  useEffect(() => {
    if (state.state === 'UNAUTHENTICATED' || state.state === 'SIGNING_OUT') {
      setSelectedCity(null)
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [state.state])

  function selectCity(city: CityResponse) {
    setSelectedCity(city)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(city))
  }

  function clearCity() {
    setSelectedCity(null)
    localStorage.removeItem(STORAGE_KEY)
  }

  const value: CityData = { selectedCity, selectCity, clearCity }

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>
}
