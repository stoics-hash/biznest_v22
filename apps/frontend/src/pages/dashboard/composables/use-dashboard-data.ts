import { useQuery } from '@tanstack/react-query'
import { getMySubscriptionSubscriptionsMeGet } from '@networking/api/generated/subscriptions/subscriptions'
import { listHazardAreasProvincesProvinceIdHazardsGet } from '@networking/api/generated/hazards/hazards'
import { listZoningAreasCitiesCityIdZoningGet } from '@networking/api/generated/zoning/zoning'
import { listEstablishmentsCitiesCityIdEstablishmentsGet } from '@networking/api/generated/establishments/establishments'
import { useAuthContext } from '@/context/auth.context'
import { useCityContext } from '@/context/city.context'

export function useDashboardData() {
  const { state } = useAuthContext()
  const { selectedCity } = useCityContext()
  const auth = state.state === 'AUTHENTICATED' ? state : null
  const cityId     = selectedCity?.id ?? null
  const provinceId = selectedCity?.province_id ?? null

  const { data: hazards = [], isLoading: hazardsLoading } = useQuery({
    queryKey: [`/provinces/${provinceId}/hazards`],
    queryFn: () => listHazardAreasProvincesProvinceIdHazardsGet(provinceId!).then(r => r.data),
    enabled: !!provinceId,
  })

  const { data: zoning = [], isLoading: zoningLoading } = useQuery({
    queryKey: [`/cities/${cityId}/zoning`],
    queryFn: () => listZoningAreasCitiesCityIdZoningGet(cityId!).then(r => r.data),
    enabled: !!cityId,
  })

  const { data: establishments = [], isLoading: establishmentsLoading } = useQuery({
    queryKey: [`/cities/${cityId}/establishments`],
    queryFn: () => listEstablishmentsCitiesCityIdEstablishmentsGet(cityId!).then(r => r.data),
    enabled: !!cityId,
  })

  const { data: subscription } = useQuery({
    queryKey: ['/subscriptions/me'],
    queryFn: () => getMySubscriptionSubscriptionsMeGet().then(r => r.data),
    enabled: auth?.role_name === 'investor',
    retry: false,
  })

  const dataLoading = hazardsLoading || zoningLoading || establishmentsLoading

  return {
    user: auth?.user ?? null,
    role_name: auth?.role_name ?? null,
    cityIds: auth?.city_ids ?? [],
    selectedCity,
    hazards,
    zoning,
    establishments,
    subscription,
    dataLoading,
  }
}
