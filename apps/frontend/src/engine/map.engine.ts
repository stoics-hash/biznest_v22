import maplibregl from 'maplibre-gl'
import type { LightPreset } from '@/context/map.context'

type GeoJsonData = Parameters<maplibregl.GeoJSONSource['setData']>[0]

export type BoundaryGeometry = {
  type: 'Polygon'
  coordinates: number[][][]
} | {
  type: 'MultiPolygon'
  coordinates: number[][][][]
}

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string

// Register PMTiles protocol once at module load.
// Requires: pnpm add pmtiles
let pmtilesRegistered = false
async function ensurePmtilesProtocol() {
  if (pmtilesRegistered) return
  const { Protocol } = await import('pmtiles')
  const protocol = new Protocol()
  maplibregl.addProtocol('pmtiles', protocol.tile.bind(protocol))
  pmtilesRegistered = true
}
ensurePmtilesProtocol()

const LIGHT_PRESETS: Record<LightPreset, maplibregl.LightSpecification> = {
  dawn:  { anchor: 'viewport', color: '#ffaa55', intensity: 0.45 },
  day:   { anchor: 'viewport', color: 'white',   intensity: 0.4  },
  dusk:  { anchor: 'viewport', color: '#ff7733', intensity: 0.35 },
  night: { anchor: 'viewport', color: '#001a33', intensity: 0.6  },
}

const CITY_MASK_SOURCE    = 'city-restriction-mask'
const CITY_BOUND_SOURCE   = 'city-boundary'
const CITY_MASK_LAYER     = 'city-restriction-overlay'
const CITY_BOUND_LAYER    = 'city-boundary-outline'

export class MapEngine {
  private readonly _map: maplibregl.Map
  private readonly _markers = new Map<string, maplibregl.Marker>()
  private readonly _popups = new Map<string, maplibregl.Popup>()
  private _cityBoundary: BoundaryGeometry | null = null

  constructor(map: maplibregl.Map) {
    this._map = map
  }

  get instance(): maplibregl.Map {
    return this._map
  }

  // ── Camera ───────────────────────────────────────────────────────────────────

  flyTo(options: maplibregl.FlyToOptions): this {
    this._map.flyTo(options)
    return this
  }

  fitBounds(bounds: maplibregl.LngLatBoundsLike, options?: maplibregl.FitBoundsOptions): this {
    this._map.fitBounds(bounds, options)
    return this
  }

  jumpTo(options: maplibregl.JumpToOptions): this {
    this._map.jumpTo(options)
    return this
  }

  easeTo(options: maplibregl.EaseToOptions): this {
    this._map.easeTo(options)
    return this
  }

  // ── Sources ──────────────────────────────────────────────────────────────────

  addGeoJsonSource(id: string, data: GeoJsonData): this {
    if (!this._map.getSource(id)) {
      this._map.addSource(id, { type: 'geojson', data })
    }
    return this
  }

  /** Add a PMTiles vector source. url = path/URL to the .pmtiles file (no protocol prefix). */
  addPmtilesSource(id: string, url: string): this {
    if (!this._map.getSource(id)) {
      this._map.addSource(id, { type: 'vector', url: `pmtiles://${url}` })
    }
    return this
  }

  updateGeoJsonSource(id: string, data: GeoJsonData): this {
    const source = this._map.getSource(id) as maplibregl.GeoJSONSource | undefined
    source?.setData(data)
    return this
  }

  removeSource(id: string): this {
    if (this._map.getSource(id)) {
      this._map.removeSource(id)
    }
    return this
  }

  hasSource(id: string): boolean {
    return !!this._map.getSource(id)
  }

  // ── Layers ───────────────────────────────────────────────────────────────────

  addLayer(layer: maplibregl.LayerSpecification, beforeId?: string): this {
    if (!this._map.getLayer(layer.id)) {
      this._map.addLayer(layer, beforeId)
    }
    return this
  }

  removeLayer(id: string): this {
    if (this._map.getLayer(id)) {
      this._map.removeLayer(id)
    }
    return this
  }

  hasLayer(id: string): boolean {
    return !!this._map.getLayer(id)
  }

  setLayerVisibility(id: string, visible: boolean): this {
    if (this._map.getLayer(id)) {
      this._map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
    }
    return this
  }

  setPaintProperty(layerId: string, name: string, value: unknown): this {
    if (this._map.getLayer(layerId)) {
      this._map.setPaintProperty(layerId, name, value)
    }
    return this
  }

  setLayoutProperty(layerId: string, name: string, value: unknown): this {
    if (this._map.getLayer(layerId)) {
      this._map.setLayoutProperty(layerId, name, value)
    }
    return this
  }

  setFilter(layerId: string, filter: maplibregl.FilterSpecification | null | undefined): this {
    if (this._map.getLayer(layerId)) {
      this._map.setFilter(layerId, filter)
    }
    return this
  }

  // ── Markers ──────────────────────────────────────────────────────────────────

  addMarker(id: string, lngLat: maplibregl.LngLatLike, options?: maplibregl.MarkerOptions): maplibregl.Marker | null {
    const { lng, lat } = maplibregl.LngLat.convert(lngLat)
    if (!this.isInsideBoundary(lng, lat)) return null
    this.removeMarker(id)
    const marker = new maplibregl.Marker(options).setLngLat(lngLat).addTo(this._map)
    this._markers.set(id, marker)
    return marker
  }

  getMarker(id: string): maplibregl.Marker | undefined {
    return this._markers.get(id)
  }

  removeMarker(id: string): this {
    this._markers.get(id)?.remove()
    this._markers.delete(id)
    return this
  }

  clearMarkers(): this {
    this._markers.forEach(m => m.remove())
    this._markers.clear()
    return this
  }

  // ── Popups ───────────────────────────────────────────────────────────────────

  addPopup(id: string, lngLat: maplibregl.LngLatLike, html: string, options?: maplibregl.PopupOptions): maplibregl.Popup {
    this.removePopup(id)
    const popup = new maplibregl.Popup(options).setLngLat(lngLat).setHTML(html).addTo(this._map)
    this._popups.set(id, popup)
    return popup
  }

  removePopup(id: string): this {
    this._popups.get(id)?.remove()
    this._popups.delete(id)
    return this
  }

  clearPopups(): this {
    this._popups.forEach(p => p.remove())
    this._popups.clear()
    return this
  }

  // ── Events ───────────────────────────────────────────────────────────────────

  onClick(callback: (e: maplibregl.MapMouseEvent) => void): () => void {
    this._map.on('click', callback)
    return () => this._map.off('click', callback)
  }

  onLayerClick(
    layerId: string,
    callback: (features: maplibregl.MapGeoJSONFeature[], e: maplibregl.MapMouseEvent) => void,
  ): () => void {
    const handler = (e: maplibregl.MapMouseEvent) => {
      const features = this._map.queryRenderedFeatures(e.point, { layers: [layerId] })
      if (features.length) callback(features, e)
    }
    this._map.on('click', layerId, handler)
    return () => this._map.off('click', layerId, handler)
  }

  onHover(
    layerId: string,
    onEnter: (e: maplibregl.MapMouseEvent) => void,
    onLeave: (e: maplibregl.MapMouseEvent) => void,
  ): () => void {
    this._map.on('mouseenter', layerId, onEnter)
    this._map.on('mouseleave', layerId, onLeave)
    return () => {
      this._map.off('mouseenter', layerId, onEnter)
      this._map.off('mouseleave', layerId, onLeave)
    }
  }

  onMoveEnd(callback: (e: maplibregl.MapLibreEvent) => void): () => void {
    this._map.on('moveend', callback)
    return () => this._map.off('moveend', callback)
  }

  // ── Query ────────────────────────────────────────────────────────────────────

  queryFeatures(point: maplibregl.PointLike, layerIds?: string[]): maplibregl.MapGeoJSONFeature[] {
    return this._map.queryRenderedFeatures(point, layerIds ? { layers: layerIds } : undefined)
  }

  // ── Cursor ───────────────────────────────────────────────────────────────────

  setCursor(cursor: string): this {
    this._map.getCanvas().style.cursor = cursor
    return this
  }

  // ── Style / terrain ──────────────────────────────────────────────────────────

  setLightPreset(preset: LightPreset): this {
    if (this._map.isStyleLoaded()) {
      this._map.setLight(LIGHT_PRESETS[preset])
    }
    return this
  }

  setTerrain(enabled: boolean): this {
    if (!this._map.isStyleLoaded()) return this
    if (enabled) {
      if (!this._map.getSource('terrain-dem')) {
        this._map.addSource('terrain-dem', {
          type: 'raster-dem',
          url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${MAPTILER_KEY}`,
          tileSize: 256,
        })
      }
      this._map.setTerrain({ source: 'terrain-dem', exaggeration: 1.5 })
    } else {
      this._map.setTerrain(null)
    }
    return this
  }

  // ── City boundary ─────────────────────────────────────────────────────────────

  /**
   * Fly the map to fit the city boundary with padding.
   */
  flyToCityBoundary(boundary: BoundaryGeometry): this {
    const [w, s, e, n] = this._bbox(boundary)
    this._map.fitBounds([[w, s], [e, n]], { padding: 60, maxZoom: 14, duration: 1200 })
    return this
  }

  /**
   * Renders a dark overlay outside the city boundary and a blue outline on the boundary edge.
   * Also restricts `isInsideBoundary` checks to this geometry.
   */
  setCityBoundary(boundary: BoundaryGeometry): this {
    if (!this._map.isStyleLoaded()) {
      // Style not ready yet — defer until the map is fully idle.
      this._map.once('idle', () => this.setCityBoundary(boundary))
      return this
    }

    this.clearCityBoundary()
    this._cityBoundary = boundary

    // Boundary outline source
    this._map.addSource(CITY_BOUND_SOURCE, {
      type: 'geojson',
      data: { type: 'Feature', geometry: boundary as never, properties: {} },
    })

    // World-minus-city mask source (polygon with holes)
    this._map.addSource(CITY_MASK_SOURCE, {
      type: 'geojson',
      data: this._buildWorldMask(boundary) as never,
    })

    // Gray desaturating fill outside city boundary
    this._map.addLayer({
      id: CITY_MASK_LAYER,
      type: 'fill',
      source: CITY_MASK_SOURCE,
      paint: {
        'fill-color': '#6b7280',
        'fill-opacity': 0.72,
      },
    })

    // City boundary outline
    this._map.addLayer({
      id: CITY_BOUND_LAYER,
      type: 'line',
      source: CITY_BOUND_SOURCE,
      paint: {
        'line-color': '#3b82f6',
        'line-width': 2,
        'line-opacity': 0.85,
        'line-dasharray': [3, 1.5],
      },
    })

    this._restrictViewToBoundary(boundary)

    return this
  }

  /**
   * Removes the city boundary overlay and restriction.
   */
  clearCityBoundary(): this {
    this.removeLayer(CITY_MASK_LAYER)
    this.removeLayer(CITY_BOUND_LAYER)
    this.removeSource(CITY_MASK_SOURCE)
    this.removeSource(CITY_BOUND_SOURCE)
    this._cityBoundary = null
    this._map.setMaxBounds(null)
    return this
  }

  /**
   * Returns true if [lng, lat] falls inside the current city boundary.
   * Returns true when no boundary is set (no restriction).
   */
  isInsideBoundary(lng: number, lat: number): boolean {
    if (!this._cityBoundary) return true
    if (this._cityBoundary.type === 'Polygon') {
      return this._pointInRing(lng, lat, this._cityBoundary.coordinates[0])
    }
    return this._cityBoundary.coordinates.some(poly => this._pointInRing(lng, lat, poly[0]))
  }

  // ── Cleanup ──────────────────────────────────────────────────────────────────

  destroy(): void {
    this.clearMarkers()
    this.clearPopups()
    this.clearCityBoundary()
  }

  // ── Private helpers ───────────────────────────────────────────────────────────

  /**
   * Lock panning to the city bbox + a small buffer so the user cannot browse
   * to unrelated areas of the map.
   */
  private _restrictViewToBoundary(boundary: BoundaryGeometry): void {
    const [w, s, e, n] = this._bbox(boundary)
    const buf = 0.3
    this._map.setMaxBounds([[w - buf, s - buf], [e + buf, n + buf]])
  }

  /** Compute [west, south, east, north] bounding box of a boundary geometry. */
  private _bbox(boundary: BoundaryGeometry): [number, number, number, number] {
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
    const visit = (ring: number[][]) => {
      for (const [lng, lat] of ring) {
        if (lng < w) w = lng
        if (lat < s) s = lat
        if (lng > e) e = lng
        if (lat > n) n = lat
      }
    }
    if (boundary.type === 'Polygon') {
      boundary.coordinates.forEach(visit)
    } else {
      boundary.coordinates.forEach(poly => poly.forEach(visit))
    }
    return [w, s, e, n]
  }

  /**
   * Builds a GeoJSON Polygon that covers the whole world with the city boundary
   * punched out as a hole, creating the outside-city overlay geometry.
   *
   * The world outer ring is CCW; city rings are reversed (CW) to act as holes
   * under the non-zero fill rule.
   */
  private _buildWorldMask(boundary: BoundaryGeometry): object {
    const worldRing: number[][] = [
      [-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90],
    ]

    const holes: number[][][] = []
    if (boundary.type === 'Polygon') {
      holes.push([...boundary.coordinates[0]].reverse())
    } else {
      for (const poly of boundary.coordinates) {
        holes.push([...poly[0]].reverse())
      }
    }

    return {
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [worldRing, ...holes] },
      properties: {},
    }
  }

  /** Ray-casting point-in-polygon for a single ring. */
  private _pointInRing(lng: number, lat: number, ring: number[][]): boolean {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
        inside = !inside
      }
    }
    return inside
  }
}