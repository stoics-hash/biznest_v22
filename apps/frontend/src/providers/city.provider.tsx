import { useEffect, useReducer, type PropsWithChildren } from 'react'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { getCityCitiesCityIdGet } from '@networking/api/generated/cities/cities'
import { useAuthContext } from '@/context/auth.context'
import { CityContext, type CityData } from '@/context/city.context'
import type { BoundaryGeometry } from '@/engine/map.engine'
import { boundaryReducer, BOUNDARY_INITIAL } from '@/reducer/boundary.reducer'

interface CityGeometryResponse {
  id: string
  boundary: BoundaryGeometry | null
}

export function CityProvider({ children }: PropsWithChildren) {
  const { state, selectCity: authSelectCity } = useAuthContext()

  const cityId = state.state === 'AUTHENTICATED' ? (state.city_id ?? null) : null

  const [boundaryState, dispatchBoundary] = useReducer(boundaryReducer, BOUNDARY_INITIAL)

  const { data: selectedCity = null } = useQuery({
    queryKey: ['/cities/', cityId],
    queryFn:  () => getCityCitiesCityIdGet(cityId!).then(r => r.data),
    enabled:  !!cityId,
    staleTime: 5 * 60 * 1000,
  })

  const {
    data: cityBoundary = null,
    isLoading: isBoundaryFetching,
    isError:   isBoundaryError,
    error:     boundaryQueryError,
  } = useQuery({
    queryKey: ['/cities/', cityId, 'geometry'],
    queryFn:  () =>
      axios.get<CityGeometryResponse>(`/cities/${cityId}/geometry`).then(r => r.data.boundary),
    enabled:  !!cityId,
    staleTime: 60 * 60 * 1000,
    retry: 1,
  })

  // Sync React Query states → reducer phase
  useEffect(() => {
    if (!cityId) {
      dispatchBoundary({ type: 'RESET' })
      return
    }
    if (isBoundaryFetching) {
      dispatchBoundary({ type: 'FETCH_START' })
      return
    }
    if (isBoundaryError) {
      const msg = boundaryQueryError instanceof Error
        ? boundaryQueryError.message
        : 'Failed to load city boundary'
      dispatchBoundary({ type: 'FETCH_ERROR', error: msg })
      return
    }
    if (cityBoundary !== null) {
      dispatchBoundary({ type: 'FETCH_SUCCESS' })
      return
    }
  }, [cityId, isBoundaryFetching, isBoundaryError, boundaryQueryError, cityBoundary])

  // Reset on city change so the old phase doesn't linger
  useEffect(() => {
    dispatchBoundary({ type: 'RESET' })
  }, [cityId])

  function clearCity() {}

  const value: CityData = {
    selectedCity,
    cityId,
    cityBoundary,
    boundaryPhase: boundaryState.phase,
    boundaryError: boundaryState.error,
    clearCity,
    selectCity: authSelectCity,
  }

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>
}
