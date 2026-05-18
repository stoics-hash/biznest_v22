import { useCallback, useEffect, useRef, useState } from 'react'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import { simplify } from '@turf/turf'
import type { Polygon, Feature } from 'geojson'
import type { IControl } from 'maplibre-gl'
import type { MapEngine } from '@/engine/map.engine'

import '@mapbox/mapbox-gl-draw/dist/mapbox-gl-draw.css'

export type DrawMode = 'draw_polygon' | 'draw_freehand'

export interface UseDrawPolygonResult {
  isActive: boolean
  activeMode: DrawMode | null
  drawnGeometry: Polygon | null
  pointCount: number
  activate: (mode: DrawMode) => Promise<void>
  deactivate: () => void
  clearDrawn: () => void
}

const PREVIEW_SOURCE = '__draw-preview'
const PREVIEW_FILL   = '__draw-preview-fill'
const PREVIEW_LINE   = '__draw-preview-line'

export function useDrawPolygon(engine: MapEngine | null): UseDrawPolygonResult {
  const drawRef    = useRef<InstanceType<typeof MapboxDraw> | null>(null)
  const handlerRef = useRef<((e: unknown) => void) | null>(null)

  const [isActive,      setIsActive]      = useState(false)
  const [activeMode,    setActiveMode]    = useState<DrawMode | null>(null)
  const [drawnGeometry, setDrawnGeometry] = useState<Polygon | null>(null)
  const [pointCount,    setPointCount]    = useState(0)

  const clearPreview = useCallback(() => {
    if (!engine) return
    engine.removeLayer(PREVIEW_FILL)
    engine.removeLayer(PREVIEW_LINE)
    engine.removeSource(PREVIEW_SOURCE)
  }, [engine])

  const addPreview = useCallback((poly: Polygon) => {
    if (!engine) return
    clearPreview()
    engine.addGeoJsonSource(PREVIEW_SOURCE, { type: 'Feature', geometry: poly, properties: {} })
    engine.addLayer({
      id:   PREVIEW_FILL,
      type: 'fill',
      source: PREVIEW_SOURCE,
      paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.25 },
    })
    engine.addLayer({
      id:   PREVIEW_LINE,
      type: 'line',
      source: PREVIEW_SOURCE,
      paint: { 'line-color': '#3b82f6', 'line-width': 2.5, 'line-opacity': 0.9 },
    })
  }, [engine, clearPreview])

  const deactivate = useCallback(() => {
    if (!engine) return
    if (handlerRef.current) {
      engine.instance.off('draw.create', handlerRef.current as never)
      handlerRef.current = null
    }
    if (drawRef.current) {
      try { engine.instance.removeControl(drawRef.current as unknown as IControl) } catch { /* already removed */ }
      drawRef.current = null
    }
    clearPreview()
    setIsActive(false)
    setActiveMode(null)
  }, [engine, clearPreview])

  const clearDrawn = useCallback(() => {
    setDrawnGeometry(null)
    setPointCount(0)
    clearPreview()
    drawRef.current?.deleteAll()
  }, [clearPreview])

  const activate = useCallback(async (mode: DrawMode) => {
    if (!engine) return
    deactivate()
    setDrawnGeometry(null)
    setPointCount(0)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let freehandMode: any = undefined
    if (mode === 'draw_freehand') {
      const mod = await import('mapbox-gl-draw-freehand-mode')
      freehandMode = mod.default ?? mod
    }

    const draw = new MapboxDraw({
      displayControlsDefault: false,
      ...(freehandMode ? { modes: { ...MapboxDraw.modes, draw_freehand: freehandMode } } : {}),
    })

    // MapboxDraw works with MapLibre GL JS at runtime; cast satisfies TS
    engine.instance.addControl(draw as unknown as IControl)
    draw.changeMode(mode)

    const handleCreate = (e: { features?: Feature[] }) => {
      const feature = e?.features?.[0]
      if (feature?.geometry?.type !== 'Polygon') return
      const simplified = simplify(
        { type: 'Feature', geometry: feature.geometry as Polygon, properties: {} },
        { tolerance: 0.0001, highQuality: true, mutate: false },
      )
      const poly = simplified.geometry as Polygon
      draw.deleteAll()
      setDrawnGeometry(poly)
      setPointCount(poly.coordinates[0].length)
      addPreview(poly)
    }

    engine.instance.on('draw.create', handleCreate as never)
    handlerRef.current = handleCreate as never
    drawRef.current    = draw
    setIsActive(true)
    setActiveMode(mode)
  }, [engine, deactivate, addPreview])

  useEffect(() => () => deactivate(), [deactivate])

  return { isActive, activeMode, drawnGeometry, pointCount, activate, deactivate, clearDrawn }
}
