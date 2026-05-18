import { useEffect, useRef, type ReactNode } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { cn } from '@/lib/utils'
import { useMapContext, type LightPreset } from '@/context/map.context'
import { useCityContext } from '@/context/city.context'
import { MapEngine } from '@/engine/map.engine'

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string
const STYLE_URL = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`

// Neutral Philippines overview — never shows a jarring close-up while boundary loads
const DEFAULT_CENTER: [number, number] = [122.0, 12.0]
const DEFAULT_ZOOM    = 6
const DEFAULT_PITCH   = 0

export interface MapProps {
  center?:   [number, number]
  zoom?:     number
  pitch?:    number
  bearing?:  number
  className?: string
  children?:  ReactNode
}

export function Map({
  center  = DEFAULT_CENTER,
  zoom    = DEFAULT_ZOOM,
  pitch   = DEFAULT_PITCH,
  bearing = 0,
  className,
  children,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef    = useRef<MapEngine | null>(null)
  const { lightPreset, show3D, setEngine } = useMapContext()
  const { cityId, isBoundaryLoading }      = useCityContext()

  const lightPresetRef = useRef<LightPreset>(lightPreset)
  const show3DRef      = useRef(show3D)
  lightPresetRef.current = lightPreset
  show3DRef.current      = show3D

  useEffect(() => {
    if (!containerRef.current || engineRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center,
      zoom,
      pitch,
      bearing,
    })

    const engine = new MapEngine(map)
    engineRef.current = engine

    map.on('style.load', () => {
      engine.setLightPreset(lightPresetRef.current)
      engine.setTerrain(show3DRef.current)
      setEngine(engine)
    })

    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100 }), 'bottom-left')
    map.addControl(new maplibregl.FullscreenControl(), 'top-right')

    return () => {
      engine.destroy()
      map.remove()
      engineRef.current = null
      setEngine(null)
    }
    // Intentionally mount-only — camera props are initial values
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Show loading overlay while city boundary geometry is being fetched.
  // Condition: user has a city selected but boundary not yet arrived.
  const showLoader = !!cityId && isBoundaryLoading

  return (
    <div ref={containerRef} className={cn('relative size-full', className)}>
      {children}

      {showLoader && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/50 backdrop-blur-[3px] pointer-events-none">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-background/90 px-8 py-6 shadow-2xl border border-border/50">
            <div className="size-7 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
            <span className="text-sm font-medium text-muted-foreground">Loading city map…</span>
          </div>
        </div>
      )}
    </div>
  )
}
