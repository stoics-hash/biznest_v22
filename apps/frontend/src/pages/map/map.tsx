import { useEffect, useRef } from 'react'
import { Map } from '@/components/map'
import { HazardControls } from './components/hazard-controls'
import { ZoneEditPopup } from './components/zone-edit-popup'
import { useMapContext } from '@/context/map.context'
import { useCityContext } from '@/context/city.context'
import type { BoundaryGeometry } from '@/engine/map.engine'

export function MapPage() {
  const { engine }        = useMapContext()
  const { cityBoundary }  = useCityContext()

  // Track previous boundary so flyTo only fires when city actually changes,
  // not on unrelated re-renders.
  const prevBoundaryRef = useRef<BoundaryGeometry | null>(null)

  useEffect(() => {
    if (!engine || !cityBoundary) return
    if (prevBoundaryRef.current === cityBoundary) return
    prevBoundaryRef.current = cityBoundary
    engine.flyToCityBoundary(cityBoundary)
  }, [engine, cityBoundary])

  return (
    <Map className="size-full">
      <HazardControls />
      <ZoneEditPopup />
    </Map>
  )
}
