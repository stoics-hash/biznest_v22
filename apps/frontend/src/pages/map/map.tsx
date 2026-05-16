import { useEffect } from 'react'
import { Map } from '@/components/map'
import { HazardControls } from './components/hazard-controls'
import { ZoneEditPopup } from './components/zone-edit-popup'
import { useMapContext } from '@/context/map.context'
import { useCityContext } from '@/context/city.context'

export function MapPage() {
  const { engine } = useMapContext()
  const { cityBoundary } = useCityContext()

  useEffect(() => {
    if (!engine || !cityBoundary) return
    engine.flyToCityBoundary(cityBoundary)
  }, [engine, cityBoundary])

  return (
    <Map className="size-full">
      <HazardControls />
      <ZoneEditPopup />
    </Map>
  )
}