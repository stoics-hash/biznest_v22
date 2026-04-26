import { useEffect, useRef, type ReactNode } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { cn } from '@/lib/utils'
import { useMapContext, type LightPreset } from '@/context/map.context'
import { MapEngine } from '@/engine/map.engine'

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string
const STYLE_URL = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`

const DEFAULT_CENTER: [number, number] = [122.0, 12.0]
const DEFAULT_ZOOM = 15
const DEFAULT_PITCH = 40

export interface MapProps {
  center?: [number, number]
  zoom?: number
  pitch?: number
  bearing?: number
  className?: string
  children?: ReactNode
}

export function Map({
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  pitch = DEFAULT_PITCH,
  bearing = 0,
  className,
  children,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef = useRef<MapEngine | null>(null)
  const { lightPreset, show3D, setEngine } = useMapContext()

  // Capture latest values so the style.load handler reads them without re-running the mount effect
  const lightPresetRef = useRef<LightPreset>(lightPreset)
  const show3DRef = useRef(show3D)
  lightPresetRef.current = lightPreset
  show3DRef.current = show3D

  useEffect(() => {
    if (!containerRef.current || engineRef.current) return

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center,
      zoom,
      pitch,
      bearing
    })

    const engine = new MapEngine(map)
    engineRef.current = engine

    map.on('style.load', () => {
      engine.setLightPreset(lightPresetRef.current)
      engine.setTerrain(show3DRef.current)
      setEngine(engine)
    })

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
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

  return (
    <div ref={containerRef} className={cn('relative size-full', className)}>
      {children}
    </div>
  )
}