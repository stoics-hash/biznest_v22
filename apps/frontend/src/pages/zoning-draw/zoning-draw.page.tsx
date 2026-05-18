import { useReducer, useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft, CheckCircle2, Move, Pencil, RotateCcw, XCircle,
} from 'lucide-react'
import { MapEngine } from '@/engine/map.engine'
import { useMapContext } from '@/context/map.context'
import { useCityContext } from '@/context/city.context'
import { useDrawPolygon } from '@/pages/map/composables/use-draw-polygon'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import {
  zoningDrawReducer,
  ZONING_DRAW_INITIAL,
  type ZoneType,
  type DrawMode,
} from '@/reducer/zoning-draw.reducer'

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string
const STYLE_URL    = `https://api.maptiler.com/maps/hybrid/style.json?key=${MAPTILER_KEY}`
const API_URL      = import.meta.env.VITE_API_URL as string

const ZONE_TYPES: ZoneType[] = ['residential', 'commercial', 'industrial', 'agriculture']

const PHASE_LABEL: Record<string, string> = {
  configuring: 'Configure',
  drawing:     'Drawing',
  drawn:       'Review',
  saving:      'Saving…',
  saved:       'Saved',
  error:       'Error',
}

export function ZoningDrawPage() {
  const navigate = useNavigate()

  const { lightPreset, show3D, refreshZoningLayer } = useMapContext()
  const { selectedCity, cityId, cityBoundary } = useCityContext()

  const containerRef = useRef<HTMLDivElement>(null)
  const engineRef    = useRef<MapEngine | null>(null)
  const [engine, setEngine] = useState<MapEngine | null>(null)
  const lightRef  = useRef(lightPreset)
  const show3DRef = useRef(show3D)
  lightRef.current  = lightPreset
  show3DRef.current = show3D

  const [state, dispatch] = useReducer(zoningDrawReducer, ZONING_DRAW_INITIAL)

  const draw = useDrawPolygon(engine)

  // ── Map mount ──────────────────────────────────────────────────────────────
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
      eng.setLightPreset(lightRef.current)
      if (show3DRef.current) eng.setTerrain(true)
      setEngine(eng)
    })
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 100 }), 'bottom-left')
    map.addControl(new maplibregl.FullscreenControl(), 'top-right')
    return () => { eng.destroy(); map.remove(); engineRef.current = null; setEngine(null) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Fly to city + boundary ─────────────────────────────────────────────────
  useEffect(() => {
    if (!engine || !cityBoundary) return
    engine.flyToCityBoundary(cityBoundary)
    engine.setCityBoundary(cityBoundary)
  }, [engine, cityBoundary])

  useEffect(() => { engine?.setLightPreset(lightPreset) }, [engine, lightPreset])
  useEffect(() => { engine?.setTerrain(show3D) }, [engine, show3D])

  // ── Bridge: drawn shape → reducer ──────────────────────────────────────────
  const phaseRef = useRef(state.phase)
  phaseRef.current = state.phase

  useEffect(() => {
    if (draw.drawnGeometry && phaseRef.current === 'drawing') {
      dispatch({ type: 'SHAPE_DRAWN', geometry: draw.drawnGeometry, pointCount: draw.pointCount })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw.drawnGeometry])

  // ── Handlers ───────────────────────────────────────────────────────────────
  function handleStartDrawing() {
    dispatch({ type: 'START_DRAWING' })
    void draw.activate(state.drawMode)
  }

  function handleCancelDrawing() {
    dispatch({ type: 'CANCEL_DRAWING' })
    draw.deactivate()
  }

  function handleClearShape() {
    dispatch({ type: 'CLEAR_SHAPE' })
    draw.clearDrawn()
  }

  function handleDrawAnother() {
    dispatch({ type: 'DRAW_ANOTHER' })
    draw.clearDrawn()
  }

  async function handleSave() {
    if (!state.geometry || !cityId) return
    dispatch({ type: 'SAVE_START' })
    try {
      const res = await fetch(`${API_URL}/cities/${cityId}/zoning`, {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city_id:   cityId,
          zone_type: state.zoneType,
          severity:  state.severity,
          geometry:  state.geometry,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({})) as { detail?: string }
        throw new Error(data.detail ?? `HTTP ${res.status}`)
      }

      const regen = await fetch(`${API_URL}/cities/${cityId}/zoning/regenerate-pmtiles`, {
        method: 'POST', credentials: 'include',
      })
      if (regen.ok) {
        const { pmtile_url } = await regen.json() as { pmtile_url: string }
        await refreshZoningLayer(pmtile_url)
      }

      dispatch({ type: 'SAVE_SUCCESS' })
      draw.clearDrawn()
    } catch (err) {
      dispatch({ type: 'SAVE_ERROR', errorMsg: err instanceof Error ? err.message : 'Save failed' })
    }
  }

  const selectCls =
    'w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs ' +
    'focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 capitalize'

  const locked = state.phase === 'drawing' || state.phase === 'saving'

  return (
    <div className="flex h-screen w-full overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-72 shrink-0 flex flex-col border-r bg-background overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0">
          <Button
            variant="ghost" size="icon"
            className="size-7 -ml-1.5 shrink-0"
            onClick={() => { draw.deactivate(); void navigate({ to: '/map' as never }) }}
          >
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate">Draw Zoning Area</span>
            <span className="text-[10px] text-muted-foreground">
              {selectedCity?.name ?? 'No city selected'}
            </span>
          </div>
          <span className={cn(
            'ml-auto shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full',
            state.phase === 'saved'    && 'bg-green-500/15 text-green-600',
            state.phase === 'error'    && 'bg-destructive/15 text-destructive',
            state.phase === 'saving'   && 'bg-blue-500/15 text-blue-600',
            state.phase === 'drawing'  && 'bg-amber-500/15 text-amber-600',
            !['saved','error','saving','drawing'].includes(state.phase) && 'bg-muted text-muted-foreground',
          )}>
            {PHASE_LABEL[state.phase]}
          </span>
        </div>

        {/* Form */}
        <div className="flex flex-col gap-3 p-4 overflow-y-auto flex-1">

          {/* Zone type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Zone Type
            </label>
            <select
              disabled={locked}
              value={state.zoneType}
              onChange={e => dispatch({ type: 'SET_ZONE_TYPE', zoneType: e.target.value as ZoneType })}
              className={selectCls}
            >
              {ZONE_TYPES.map(t => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          {/* Severity */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Severity
              </label>
              <span className="text-xs font-semibold tabular-nums">{state.severity} / 5</span>
            </div>
            <input
              type="range" min={1} max={5} step={1}
              disabled={state.phase === 'saving'}
              value={state.severity}
              onChange={e => dispatch({ type: 'SET_SEVERITY', severity: Number(e.target.value) })}
              className="w-full accent-primary disabled:opacity-50"
            />
            <div className="flex justify-between text-[9px] text-muted-foreground">
              <span>Low</span><span>High</span>
            </div>
          </div>

          <Separator />

          {/* Draw mode */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
              Draw Mode
            </span>
            <div className="flex gap-1">
              {(['draw_polygon', 'draw_freehand'] as DrawMode[]).map(m => (
                <button
                  key={m}
                  disabled={locked}
                  onClick={() => dispatch({ type: 'SET_DRAW_MODE', drawMode: m })}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs',
                    'border transition-all disabled:pointer-events-none disabled:opacity-40',
                    state.drawMode === m
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground',
                  )}
                >
                  {m === 'draw_polygon' ? <Pencil className="size-3" /> : <Move className="size-3" />}
                  {m === 'draw_polygon' ? 'Polygon' : 'Freehand'}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              {state.drawMode === 'draw_polygon'
                ? 'Click to place points · double-click to finish'
                : 'Hold and drag on the map'}
            </p>
          </div>

          <Separator />

          {/* Phase actions */}
          {(state.phase === 'configuring' || state.phase === 'drawn') && (
            <Button size="sm" className="w-full text-xs h-8" onClick={handleStartDrawing}>
              {state.phase === 'drawn' ? 'Redraw' : 'Start Drawing'}
            </Button>
          )}

          {state.phase === 'drawing' && (
            <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={handleCancelDrawing}>
              Cancel Drawing
            </Button>
          )}

          {(state.phase === 'drawn' || state.phase === 'error') && state.geometry && (
            <div className="rounded-md bg-muted/60 px-3 py-2 text-[11px] flex items-center gap-2">
              <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
              <span>Shape ready · <span className="font-medium tabular-nums">{state.pointCount} pts</span></span>
              <button
                onClick={handleClearShape}
                className="ml-auto text-[10px] text-muted-foreground hover:text-foreground"
              >
                Clear
              </button>
            </div>
          )}

          {state.phase === 'drawn' && (
            <Button size="sm" className="w-full text-xs h-8" onClick={() => void handleSave()}>
              Save to Map
            </Button>
          )}

          {state.phase === 'saving' && (
            <Button size="sm" disabled className="w-full text-xs h-8">Saving…</Button>
          )}

          {state.phase === 'saved' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                <CheckCircle2 className="size-3.5" />
                Saved — layer updated on map
              </div>
              <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={handleDrawAnother}>
                <RotateCcw className="size-3 mr-1.5" />
                Draw Another
              </Button>
            </div>
          )}

          {state.phase === 'error' && (
            <div className="flex flex-col gap-2">
              <div className="flex items-start gap-1.5 text-xs text-destructive">
                <XCircle className="size-3.5 mt-0.5 shrink-0" />
                <span>{state.errorMsg}</span>
              </div>
              <Button size="sm" className="w-full text-xs h-8" onClick={() => void handleSave()}>
                Retry Save
              </Button>
            </div>
          )}

        </div>
      </aside>

      {/* ── Map canvas ──────────────────────────────────────────────────────── */}
      <div ref={containerRef} className="flex-1 relative" />

    </div>
  )
}
