import { createContext, useContext } from 'react'
import type { MapEngine } from '@/engine/map.engine'

export type LightPreset = 'dawn' | 'day' | 'dusk' | 'night'

export interface MapData {
  engine: MapEngine | null
  setEngine: (engine: MapEngine | null) => void
  lightPreset: LightPreset
  setLightPreset: (preset: LightPreset) => void
  show3D: boolean
  setShow3D: (v: boolean) => void
}

export const MapContext = createContext<MapData>({
  engine: null,
  setEngine: () => {},
  lightPreset: 'day',
  setLightPreset: () => {},
  show3D: true,
  setShow3D: () => {},
})

export const useMapContext = () => useContext(MapContext)