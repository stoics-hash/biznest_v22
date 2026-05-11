import { useState, useEffect, useCallback, useRef, type PropsWithChildren } from 'react'
import { MapContext, type LightPreset, type ClickedZone } from '@/context/map.context'
import { useCityContext } from '@/context/city.context'
import { listHazardPmtilesCitiesCityIdHazardsPmtilesGet } from '@networking/api/generated/hazards/hazards'
import { getZoningPmtilesCitiesCityIdZoningPmtilesGet } from '@networking/api/generated/zoning/zoning'
import type { MapEngine, BoundaryGeometry, HazardTile } from '@/engine/map.engine'

// ── PMTile source-layer discovery ────────────────────────────────────────────
// Reads the PMTile's TileJSON metadata to find the first vector layer id.
// This is the name tippecanoe baked in from the input filename stem.
// Requires MinIO CORS to be configured (GET + HEAD from the frontend origin).

async function discoverSourceLayer(url: string): Promise<string | undefined> {
  try {
    const { PMTiles } = await import('pmtiles')
    const pm   = new PMTiles(url)
    const meta = await pm.getMetadata() as { vector_layers?: { id: string }[] } | null
    const id   = meta?.vector_layers?.[0]?.id
    if (id) console.debug(`[PMTile] source-layer="${id}" for ${url.split('/').slice(-3, -1).join('/')}`)
    return id
  } catch (err) {
    console.warn('[PMTile] metadata fetch failed — CORS may not be configured on MinIO:', err)
    return undefined
  }
}

async function enrichWithSourceLayers(tiles: HazardTile[]): Promise<HazardTile[]> {
  return Promise.all(
    tiles.map(async tile => ({
      ...tile,
      source_layer: await discoverSourceLayer(tile.pmtile_url),
    }))
  )
}

// ── Provider ─────────────────────────────────────────────────────────────────

export function MapProvider({ children }: PropsWithChildren) {
  const [engine, setEngine] = useState<MapEngine | null>(null)
  const [lightPreset, setLightPreset] = useState<LightPreset>('day')
  const [show3D, setShow3D] = useState(true)
  const [hazardLayers, setHazardLayersState] = useState<HazardTile[]>([])
  const [visibleHazardKeys, setVisibleHazardKeys] = useState<Set<string>>(new Set())
  const [zoningTile, setZoningTile] = useState<{ url: string; sourceLayer: string } | null>(null)
  const [showZoning, setShowZoning] = useState(true)
  const [visibleZoningTypes, setVisibleZoningTypes] = useState<Set<string> | null>(null)
  const [clickedZone, setClickedZone] = useState<ClickedZone | null>(null)

  const { selectedCity } = useCityContext()

  // Always-current refs so onReady callbacks inside setZoningLayer read latest state.
  const showZoningRef = useRef(showZoning)
  showZoningRef.current = showZoning
  const visibleZoningTypesRef = useRef(visibleZoningTypes)
  visibleZoningTypesRef.current = visibleZoningTypes

  // ── Light preset ─────────────────────────────────────────────────────────

  useEffect(() => {
    engine?.setLightPreset(lightPreset)
  }, [engine, lightPreset])

  // ── Terrain ──────────────────────────────────────────────────────────────

  useEffect(() => {
    engine?.setTerrain(show3D)
  }, [engine, show3D])

  // ── City boundary + pan restriction ──────────────────────────────────────
  // selectedCity already carries the full CityResponse (including boundary),
  // so no extra API call is needed.

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

  // ── Hazard PMTile fetch ───────────────────────────────────────────────────
  // 1. Fetch the list of PMTile URLs for the province.
  // 2. Read each PMTile's TileJSON metadata to discover the actual source-layer
  //    name baked in by tippecanoe — avoids hardcoding a name that may vary.
  // PMTile URLs are presigned MinIO URLs (5-hour TTL); re-navigating refreshes them.

  useEffect(() => {
    if (!selectedCity?.id) return

    let cancelled = false

    listHazardPmtilesCitiesCityIdHazardsPmtilesGet(selectedCity.id)
      .then(async res => {
        if (cancelled) return
        const tiles = await enrichWithSourceLayers(res.data as HazardTile[])
        if (cancelled) return
        setHazardLayersState(tiles)
        setVisibleHazardKeys(new Set(tiles.map(t => `${t.hazard_type}::${t.scenario ?? 'all'}`)))
      })
      .catch(() => {
        // Province has no hazard data yet.
      })

    return () => {
      cancelled = true
      setHazardLayersState([])
      setVisibleHazardKeys(new Set())
    }
  }, [selectedCity?.id])

  // ── Zoning PMTile fetch ───────────────────────────────────────────────────
  // City-scoped (one PMTile per city). 404 = no zoning data yet.

  useEffect(() => {
    if (!selectedCity?.id) return

    let cancelled = false

    getZoningPmtilesCitiesCityIdZoningPmtilesGet(selectedCity.id)
      .then(async res => {
        if (cancelled) return
        const url = res.data.pmtile_url
        const sl = await discoverSourceLayer(url)
        if (cancelled) return
        setZoningTile({ url, sourceLayer: sl ?? 'zoning' })
      })
      .catch(() => {
        // City has no zoning data yet — stay cleared.
      })

    return () => {
      cancelled = true
      setZoningTile(null)
      setVisibleZoningTypes(null)
    }
  }, [selectedCity?.id])

  // ── Load zoning layer into engine ─────────────────────────────────────────

  useEffect(() => {
    if (!engine) return
    if (!zoningTile) {
      engine.clearZoningLayer()
      return
    }
    engine.setZoningLayer(zoningTile.url, zoningTile.sourceLayer, () => {
      engine.setZoningLayerVisible(showZoningRef.current)
      engine.setZoningTypeFilter(
        visibleZoningTypesRef.current === null ? null : [...visibleZoningTypesRef.current]
      )
    })
  }, [engine, zoningTile])

  // ── Sync zoning visibility ────────────────────────────────────────────────

  useEffect(() => {
    engine?.setZoningLayerVisible(showZoning)
  }, [engine, showZoning])

  // ── Load hazard layers into engine ────────────────────────────────────────

  useEffect(() => {
    if (!engine) return
    engine.setHazardLayers(hazardLayers)
  }, [engine, hazardLayers])

  // ── Sync visibility state → engine ───────────────────────────────────────

  useEffect(() => {
    if (!engine) return
    for (const tile of hazardLayers) {
      const key = engine.hazardKey(tile)
      engine.setHazardLayerVisible(key, visibleHazardKeys.has(key))
    }
  }, [engine, hazardLayers, visibleHazardKeys])

  // ── Toggle ────────────────────────────────────────────────────────────────

  const toggleHazard = useCallback((key: string) => {
    setVisibleHazardKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  // ── Sync zoning type filter → engine ─────────────────────────────────────

  useEffect(() => {
    if (!engine) return
    engine.setZoningTypeFilter(visibleZoningTypes === null ? null : [...visibleZoningTypes])
  }, [engine, visibleZoningTypes])

  const toggleZoningType = useCallback((type: string, allTypes: string[]) => {
    setVisibleZoningTypes(prev => {
      const expanded = prev === null ? new Set(allTypes) : new Set(prev)
      if (expanded.has(type)) expanded.delete(type)
      else expanded.add(type)
      // All types visible → clear filter
      if (expanded.size === allTypes.length) return null
      return expanded
    })
  }, [])

  // ── Zone click handler ────────────────────────────────────────────────────

  useEffect(() => {
    if (!engine) return
    engine.setupZoneClickHandler((id, zoneType, lngLat) => {
      setClickedZone({ id, zoneType, lngLat: { lng: lngLat.lng, lat: lngLat.lat } })
    })
    return () => { engine.teardownZoneClickHandler() }
  }, [engine])

  const refreshZoningLayer = useCallback(async (url: string) => {
    const sl = await discoverSourceLayer(url)
    setZoningTile({ url, sourceLayer: sl ?? 'zoning' })
  }, [])

  return (
    <MapContext.Provider value={{
      engine, setEngine,
      lightPreset, setLightPreset,
      show3D, setShow3D,
      hazardLayers,
      visibleHazardKeys,
      toggleHazard,
      zoningPmtileUrl: zoningTile?.url ?? null,
      showZoning,
      setShowZoning,
      visibleZoningTypes,
      toggleZoningType,
      clickedZone,
      setClickedZone,
      refreshZoningLayer,
    }}>
      {children}
    </MapContext.Provider>
  )
}