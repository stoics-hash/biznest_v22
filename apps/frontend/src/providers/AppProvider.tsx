import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { AuthProvider } from '@/providers/AuthProvider'
import { CityProvider } from '@/providers/city.provider'
import { MapProvider } from '@/providers/map.provider'
import { RouteWithContext } from '@/providers/RouteWithContext'

export function AppProvider() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CityProvider>
          <MapProvider>
            <RouteWithContext />
          </MapProvider>
        </CityProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}