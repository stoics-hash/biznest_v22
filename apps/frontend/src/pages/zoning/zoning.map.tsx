import { useState, useEffect, useRef, type PropsWithChildren } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapContext, useMapContext } from '@/context/map.context'
import { MapEngine, type BoundaryGeometry } from '@/engine/map.engine'
import { useCityContext } from '@/context/city.context'
import { useGeoreference } from './composables/use-georeference'
import { GeoReferenceControls } from './components/georeference-controls'

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string
const STYLE_URL = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`

// ── ZoningMap ─────────────────────────────────────────────────────────────────
// Own MapLibre instance that overrides MapContext — no hazard loading,
// city boundary fly-to preserved.

function ZoningMap({ children }: PropsWithChildren) {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef    = useRef<MapEngine | null>(null)
  const [engine, setEngine] = useState<MapEngine | null>(null)
  const { selectedCity } = useCityContext()
  // Inherit light/3D prefs from outer MapProvider without triggering its hazard effects
  const { lightPreset, show3D } = useMapContext()

  // Mount map once
  useEffect(() => {
    if (!containerRef.current || engineRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [122.0, 12.0],
      zoom: 6,
      pitch: 0,
    })

    const eng = new MapEngine(map)
    engineRef.current = eng

    map.on('style.load', () => {
      eng.setLightPreset(lightPreset)
      if (show3D) eng.setTerrain(true)
      setEngine(eng)
    })

    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100 }), 'bottom-left')
    map.addControl(new maplibregl.FullscreenControl(), 'top-right')

    return () => {
      eng.destroy()
      map.remove()
      engineRef.current = null
      setEngine(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Fly to selected city + show boundary (reference for alignment)
  useEffect(() => {
    if (!engine || !selectedCity) return
    const boundary = selectedCity.boundary as BoundaryGeometry | null
    if (!boundary) return
    engine.flyToCityBoundary(boundary)
    engine.setCityBoundary(boundary)
  }, [engine, selectedCity, selectedCity?.id])

  return (
    // Override the outer MapContext — children see this engine, not MapProvider's
    <MapContext.Provider value={{
      engine,
      setEngine,
      lightPreset,
      setLightPreset: () => {},
      show3D,
      setShow3D: () => {},
      hazardLayers: [],
      visibleHazardKeys: new Set(),
      toggleHazard: () => {},
    }}>
      <div ref={containerRef} className="relative size-full">
        {children}
      </div>
    </MapContext.Provider>
  )
}

// ── Corner marker handles ─────────────────────────────────────────────────────

const CORNER_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b']
const CORNER_LABELS = ['TL', 'TR', 'BR', 'BL']

function makeHandleEl(index: number): HTMLElement {
  const el = document.createElement('div')
  el.style.cssText = [
    `background:${CORNER_COLORS[index]}`,
    'width:18px', 'height:18px',
    'border:2px solid white',
    'border-radius:50%',
    'cursor:grab',
    'display:flex', 'align-items:center', 'justify-content:center',
    'font-size:7px', 'font-weight:700', 'color:white',
    'box-shadow:0 2px 6px rgba(0,0,0,0.6)',
    'user-select:none',
  ].join(';')
  el.textContent = CORNER_LABELS[index]
  return el
}

function GeoRefLayer() {
  const { engine } = useMapContext()
  const geo = useGeoreference()
  const markersRef      = useRef<maplibregl.Marker[]>([])
  const draggingRef     = useRef(new Set<number>())
  const updateCornerRef = useRef(geo.updateCorner)
  updateCornerRef.current = geo.updateCorner

  // Create / destroy corner markers when image loaded or cleared
  useEffect(() => {
    markersRef.current.forEach(m => m.remove())
    markersRef.current = []
    if (!engine || !geo.corners) return

    const markers: maplibregl.Marker[] = geo.corners.map((corner, i) => {
      const marker = new maplibregl.Marker({ element: makeHandleEl(i), draggable: true })
        .setLngLat(corner as maplibregl.LngLatLike)
        .addTo(engine.instance)

      marker.on('dragstart', () => draggingRef.current.add(i))
      marker.on('drag',      () => { const { lng, lat } = marker.getLngLat(); updateCornerRef.current(i, [lng, lat]) })
      marker.on('dragend',   () => draggingRef.current.delete(i))
      return marker
    })

    markersRef.current = markers
    return () => { markers.forEach(m => m.remove()); markersRef.current = [] }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, !!geo.corners])

  // Sync positions from rotation slider (skip corners being dragged)
  useEffect(() => {
    if (!geo.corners) return
    geo.corners.forEach((corner, i) => {
      if (!draggingRef.current.has(i)) {
        markersRef.current[i]?.setLngLat(corner as maplibregl.LngLatLike)
      }
    })
  }, [geo.corners])

  return (
    <GeoReferenceControls
      {...geo}
      onLoad={geo.loadImage}
      onRotate={geo.applyRotation}
      onOpacity={geo.updateOpacity}
      onSave={geo.saveAlignment}
      onClear={geo.clearOverlay}
    />
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export function ZoningMapPage() {
  return (
    <ZoningMap>
      <GeoRefLayer />
    </ZoningMap>
  )
}