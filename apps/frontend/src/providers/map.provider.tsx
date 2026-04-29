import { useState, useEffect, useCallback, type PropsWithChildren } from 'react'
import { MapContext, type LightPreset } from '@/context/map.context'
import { useCityContext } from '@/context/city.context'
import { listHazardPmtilesProvincesProvinceIdHazardsPmtilesGet } from '@networking/api/generated/hazards/hazards'
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
  const [zoningPmtileUrl, setZoningPmtileUrl] = useState<string | null>(null)
  const [zoningSourceLayer, setZoningSourceLayer] = useState<string | undefined>(undefined)
  const [showZoning, setShowZoning] = useState(true)

  const { selectedCity } = useCityContext()

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
    if (!selectedCity?.province_id) return

    let cancelled = false

    listHazardPmtilesProvincesProvinceIdHazardsPmtilesGet(selectedCity.province_id)
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
  }, [selectedCity?.province_id])

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
        setZoningPmtileUrl(url)
        setZoningSourceLayer(sl ?? 'zoning')
      })
      .catch(() => {
        // City has no zoning data yet — stay cleared.
      })

    return () => {
      cancelled = true
      setZoningPmtileUrl(null)
      setZoningSourceLayer(undefined)
    }
  }, [selectedCity?.id])

  // ── Load zoning layer into engine ─────────────────────────────────────────

  useEffect(() => {
    if (!engine) return
    if (!zoningPmtileUrl || !zoningSourceLayer) {
      engine.clearZoningLayer()
      return
    }
    engine.setZoningLayer(zoningPmtileUrl, zoningSourceLayer)
  }, [engine, zoningPmtileUrl, zoningSourceLayer])

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

  return (
    <MapContext.Provider value={{
      engine, setEngine,
      lightPreset, setLightPreset,
      show3D, setShow3D,
      hazardLayers,
      visibleHazardKeys,
      toggleHazard,
      zoningPmtileUrl,
      showZoning,
      setShowZoning,
    }}>
      {children}
    </MapContext.Provider>
  )
}