import { createContext, useContext } from 'react'
import type { MapEngine, HazardTile } from '@/engine/map.engine'

export type LightPreset = 'dawn' | 'day' | 'dusk' | 'night'

export interface MapData {
  engine: MapEngine | null
  setEngine: (engine: MapEngine | null) => void
  lightPreset: LightPreset
  setLightPreset: (preset: LightPreset) => void
  show3D: boolean
  setShow3D: (v: boolean) => void
  /** Hazard PMTile layers loaded for the current province. */
  hazardLayers: HazardTile[]
  /** Keys of currently visible hazard layers (use `engine.hazardKey(tile)` to build keys). */
  visibleHazardKeys: Set<string>
  /** Toggle a single hazard layer on or off by its key. */
  toggleHazard: (key: string) => void
}

export const MapContext = createContext<MapData>({
  engine: null,
  setEngine: () => {},
  lightPreset: 'day',
  setLightPreset: () => {},
  show3D: true,
  setShow3D: () => {},
  hazardLayers: [],
  visibleHazardKeys: new Set(),
  toggleHazard: () => {},
})

export const useMapContext = () => useContext(MapContext)