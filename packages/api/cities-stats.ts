import { useQuery } from '@tanstack/react-query'
import type { UseQueryOptions, UseQueryResult } from '@tanstack/react-query'
import * as axios from 'axios'
import type { AxiosResponse } from 'axios'

export interface CityStatsResponse {
  city_id: string
  hazard_count: number
  zoning_count: number
  establishment_count: number
  alert_count: number
}

export const getCityStats = (cityId: string): Promise<AxiosResponse<CityStatsResponse>> =>
  axios.default.get(`/cities/${cityId}/stats`)

export const useGetCityStats = (
  cityId: string | null,
  options?: Omit<UseQueryOptions<AxiosResponse<CityStatsResponse>>, 'queryKey' | 'queryFn'>,
): UseQueryResult<AxiosResponse<CityStatsResponse>> =>
  useQuery({
    queryKey: [`/cities/${cityId}/stats`],
    queryFn: () => getCityStats(cityId!),
    enabled: !!cityId,
    ...options,
  })
