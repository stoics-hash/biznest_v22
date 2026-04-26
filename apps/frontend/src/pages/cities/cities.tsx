import { useState, useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { MapPin, Search, ChevronLeft, ChevronRight, Map as MapIcon } from 'lucide-react'
import { listCitiesCitiesGet, createCityCitiesPost } from '@networking/api/generated/cities/cities'
import { createAssignmentLguAssignmentsPost } from '@networking/api/generated/lgu-assignments/lgu-assignments'
import type { CityCreate } from '@networking/api/model/cityCreate'
import type { CityResponse } from '@networking/api/model/cityResponse'
import { useAuthContext } from '@/context/auth.context'
import { useCityContext } from '@/context/city.context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { CreateCityDialog } from '@/pages/city-setup/components/create-city-dialog'

const PAGE_SIZE = 15

export function CitiesPage() {
  const { state } = useAuthContext()
  const { selectCity } = useCityContext()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const auth = state.state === 'AUTHENTICATED' ? state : null
  const isLgu = auth?.role_name === 'lgu_admin'

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data: cities = [], isLoading } = useQuery({
    queryKey: ['/cities/'],
    queryFn: () => listCitiesCitiesGet().then(r => r.data),
  })

  const createCity = useMutation({
    mutationFn: (data: CityCreate) => createCityCitiesPost(data),
    onSuccess: async res => {
      await queryClient.invalidateQueries({ queryKey: ['/cities/'] })
      if (isLgu && auth) {
        await createAssignmentLguAssignmentsPost({ user_id: auth.user.id, city_id: res.data.id })
        await queryClient.invalidateQueries({ queryKey: ['/lgu-assignments/'] })
      }
    },
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return cities
    return cities.filter(
      c =>
        c.name.toLowerCase().includes(q) ||
        c.province?.toLowerCase().includes(q) ||
        c.region?.toLowerCase().includes(q),
    )
  }, [cities, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageSlice = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function openOnMap(city: CityResponse) {
    selectCity(city)
    void navigate({ to: '/map' as never })
  }

  function handleSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Cities</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} of {cities.length} cities
          </p>
        </div>
        {isLgu && <CreateCityDialog mutation={createCity} />}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search by city, province or region…"
          value={search}
          onChange={e => handleSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Spinner className="size-4" />
          Loading cities…
        </div>
      ) : pageSlice.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {search ? `No cities match "${search}"` : 'No cities found.'}
        </div>
      ) : (
        <div className="divide-y rounded-lg border overflow-hidden">
          {pageSlice.map(city => (
            <div
              key={city.id}
              className="flex items-center justify-between px-4 py-3 bg-card hover:bg-muted/30 transition-colors gap-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <MapPin className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{city.name}</p>
                  {(city.province || city.region) && (
                    <p className="text-xs text-muted-foreground truncate">
                      {[city.province, city.region].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="shrink-0 gap-1.5"
                onClick={() => openOnMap(city)}
              >
                <MapIcon className="size-3.5" />
                View on Map
              </Button>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-muted-foreground">
            Page {safePage} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={safePage <= 1}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={safePage >= totalPages}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}