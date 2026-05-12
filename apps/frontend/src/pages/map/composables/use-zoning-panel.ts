import { useGetZoningPmtilesCitiesCityIdZoningPmtilesGet, useListZoningAreasCitiesCityIdZoningGet } from '@networking/api/generated/zoning/zoning'
import { useCityContext } from '@/context/city.context'

export function useZoningPanel() {
  const { selectedCity } = useCityContext()

  const { data: pmtilesRes, isLoading: pmtilesLoading } = useGetZoningPmtilesCitiesCityIdZoningPmtilesGet(
    selectedCity?.id ?? '',
    { query: { enabled: !!selectedCity?.id, retry: false } },
  )
  const pmtileUrl = pmtilesRes?.data?.pmtile_url ?? null

  const { data, isLoading: zonesLoading } = useListZoningAreasCitiesCityIdZoningGet(
    selectedCity?.id ?? '',
    { query: { enabled: !!selectedCity?.id } },
  )
  const zones = data?.data ?? []
  const isLoading = pmtilesLoading || zonesLoading

  const grouped = zones.reduce<Record<string, number>>((acc, z) => {
    const key = z.zone_type ?? '(unlabelled)'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const zoneTypes = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))

  return { pmtileUrl, zones, zoneTypes, isLoading }
}