import { useState, useEffect, type PropsWithChildren } from 'react'
import { MapContext, type LightPreset } from '@/context/map.context'
import { useCityContext } from '@/context/city.context'
import type { MapEngine, BoundaryGeometry } from '@/engine/map.engine'

export function MapProvider({ children }: PropsWithChildren) {
  const [engine, setEngine] = useState<MapEngine | null>(null)
  const [lightPreset, setLightPreset] = useState<LightPreset>('day')
  const [show3D, setShow3D] = useState(true)
  const { selectedCity } = useCityContext()

  useEffect(() => {
    engine?.setLightPreset(lightPreset)
  }, [engine, lightPreset])

  useEffect(() => {
    engine?.setTerrain(show3D)
  }, [engine, show3D])

  // Apply city boundary whenever the engine or selected city changes.
  // selectedCity already carries the full CityResponse (including boundary geometry)
  // from the city context — no extra API call needed.
  useEffect(() => {
    if (!engine) return

    if (!selectedCity) {
      engine.clearCityBoundary()
      return
    }

    const boundary = selectedCity.boundary as BoundaryGeometry | null
    if (!boundary) return

    engine.flyToCityBoundary(boundary)
    engine.setCityBoundary(boundary)
  }, [engine, selectedCity?.id])

  return (
    <MapContext.Provider value={{ engine, setEngine, lightPreset, setLightPreset, show3D, setShow3D }}>
      {children}
    </MapContext.Provider>
  )
}