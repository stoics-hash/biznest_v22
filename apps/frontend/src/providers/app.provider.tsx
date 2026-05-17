import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { AuthProvider } from '@/providers/auth.provider.tsx'
import { CityProvider } from '@/providers/city.provider'
import { MapProvider } from '@/providers/map.provider'
import { RouteContext } from '@/context/route.context.tsx'

export function AppProvider() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <CityProvider>
          <MapProvider>
            <RouteContext />
          </MapProvider>
        </CityProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}