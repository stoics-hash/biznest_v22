import { createContext, useContext } from 'react'
import type { MapEngine, HazardTile } from '@/engine/map.engine'

export type LightPreset = 'dawn' | 'day' | 'dusk' | 'night'

export interface ClickedZone {
  id: string
  zoneType: string
  lngLat: { lng: number; lat: number }
}

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
  /** Presigned MinIO URL for the city zoning PMTile (5-hour TTL). Null = no zoning data. */
  zoningPmtileUrl: string | null
  showZoning: boolean
  setShowZoning: (v: boolean) => void
  /** null = all types visible (no filter applied). Set = only those zone_type values shown. */
  visibleZoningTypes: Set<string> | null
  /** Toggle one zone_type. allTypes = full list of known types for this city. */
  toggleZoningType: (type: string, allTypes: string[]) => void
  /** Zone feature clicked on the map. null = no selection. */
  clickedZone: ClickedZone | null
  setClickedZone: (zone: ClickedZone | null) => void
  /** Re-fetch source-layer from new URL then swap the engine's zoning layer. Pass null to clear entirely. */
  refreshZoningLayer: (url: string | null) => Promise<void>
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
  zoningPmtileUrl: null,
  showZoning: true,
  setShowZoning: () => {},
  visibleZoningTypes: null,
  toggleZoningType: () => {},
  clickedZone: null,
  setClickedZone: () => {},
  refreshZoningLayer: async () => {},
})

export const useMapContext = () => useContext(MapContext)