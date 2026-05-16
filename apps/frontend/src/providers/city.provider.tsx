import { type PropsWithChildren } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { getCityCitiesCityIdGet } from '@networking/api/generated/cities/cities'
import { useAuthContext } from '@/context/auth.context'
import { CityContext, type CityData } from '@/context/city.context'
import type { BoundaryGeometry } from '@/engine/map.engine'

interface CityGeometryResponse {
  id: string
  boundary: BoundaryGeometry | null
}

export function CityProvider({ children }: PropsWithChildren) {
  const { state, selectCity: authSelectCity } = useAuthContext()

  const cityId = state.state === 'AUTHENTICATED' ? (state.city_id ?? null) : null

  const { data: selectedCity = null } = useQuery({
    queryKey: ['/cities/', cityId],
    queryFn: () => getCityCitiesCityIdGet(cityId!).then(r => r.data),
    enabled: !!cityId,
    staleTime: 5 * 60 * 1000,
  })

  const { data: cityBoundary = null } = useQuery({
    queryKey: ['/cities/', cityId, 'geometry'],
    queryFn: () =>
      axios.get<CityGeometryResponse>(`/cities/${cityId}/geometry`).then(r => r.data.boundary),
    enabled: !!cityId,
    staleTime: 60 * 60 * 1000, // 1 hour — matches backend Redis TTL
  })

  function clearCity() {}

  const value: CityData = {
    selectedCity,
    cityId,
    cityBoundary,
    clearCity,
    selectCity: authSelectCity,
  }

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>
}