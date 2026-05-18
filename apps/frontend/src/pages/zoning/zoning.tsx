import { useReducer, useEffect, useRef, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft, CheckCircle2, FileJson, Move, Pencil, RotateCcw,
  ScanText, Upload, X, XCircle, PenLine,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Polygon } from 'geojson'
import { Map } from '@/components/map'
import { MapContext, useMapContext } from '@/context/map.context'
import type { MapEngine } from '@/engine/map.engine'
import { useCityContext } from '@/context/city.context'
import { useDrawPolygon } from '@/pages/map/composables/use-draw-polygon'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import {
  zoningDrawReducer,
  ZONING_DRAW_INITIAL,
  type ZoneType,
  type DrawMode,
} from '@/reducer/zoning-draw.reducer'
import {
  zoningUploadReducer,
  ZONING_UPLOAD_INITIAL,
} from '@/reducer/zoning-upload.reducer'

const API_URL = import.meta.env.VITE_API_URL as string

const ZONE_TYPES: ZoneType[] = ['residential', 'commercial', 'industrial', 'agriculture']

type ActivePanel = 'draw' | 'upload' | null

const PANEL_BUTTONS: { id: NonNullable<ActivePanel> | 'ocr'; icon: LucideIcon; label: string }[] = [
  { id: 'draw',   icon: PenLine,  label: 'Draw Zoning Area' },
  { id: 'upload', icon: Upload,   label: 'Upload GeoJSON' },
  { id: 'ocr',    icon: ScanText, label: 'OCR + Georeferencing' },
]

function extractPolygon(text: string): Polygon | null {
  try {
    const json = JSON.parse(text) as Record<string, unknown>
    if (json.type === 'Polygon') return json as unknown as Polygon
    if (json.type === 'Feature') {
      const geom = (json as { geometry?: { type?: string } }).geometry
      if (geom?.type === 'Polygon') return geom as unknown as Polygon
    }
    if (json.type === 'FeatureCollection') {
      const feat = (json as { features?: { geometry?: { type?: string } }[] }).features?.[0]
      if (feat?.geometry?.type === 'Polygon') return feat.geometry as unknown as Polygon
    }
    return null
  } catch { return null }
}

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload  = e => resolve(e.target?.result as string)
    reader.onerror = reject
    reader.readAsText(file)
  })
}

const selectCls =
  'w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs ' +
  'focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 capitalize'

// ── Draw panel ────────────────────────────────────────────────────────────────

function DrawPanelContent({
  draw, dispatch, onStartDrawing, onCancelDrawing, onSave,
}: {
  draw:            ReturnType<typeof zoningDrawReducer>
  dispatch:        React.Dispatch<Parameters<typeof zoningDrawReducer>[1]>
  onStartDrawing:  () => void
  onCancelDrawing: () => void
  onSave:          () => Promise<void>
}) {
  const locked = draw.phase === 'drawing' || draw.phase === 'saving'
  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto flex-1">
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Zone Type</label>
        <select disabled={locked} value={draw.zoneType}
          onChange={e => dispatch({ type: 'SET_ZONE_TYPE', zoneType: e.target.value as ZoneType })}
          className={selectCls}>
          {ZONE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Severity</label>
          <span className="text-xs font-semibold tabular-nums">{draw.severity} / 5</span>
        </div>
        <input type="range" min={1} max={5} step={1} disabled={draw.phase === 'saving'}
          value={draw.severity} onChange={e => dispatch({ type: 'SET_SEVERITY', severity: Number(e.target.value) })}
          className="w-full accent-primary disabled:opacity-50" />
        <div className="flex justify-between text-[9px] text-muted-foreground"><span>Low</span><span>High</span></div>
      </div>
      <Separator />
      <div className="flex flex-col gap-1.5">
        <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Draw Mode</span>
        <div className="flex gap-1">
          {(['draw_polygon', 'draw_freehand'] as DrawMode[]).map(m => (
            <button key={m} disabled={locked} onClick={() => dispatch({ type: 'SET_DRAW_MODE', drawMode: m })}
              className={cn(
                'flex-1 flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs border transition-all',
                'disabled:pointer-events-none disabled:opacity-40',
                draw.drawMode === m
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'text-muted-foreground border-border hover:border-foreground/30 hover:text-foreground',
              )}>
              {m === 'draw_polygon' ? <Pencil className="size-3" /> : <Move className="size-3" />}
              {m === 'draw_polygon' ? 'Polygon' : 'Freehand'}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          {draw.drawMode === 'draw_polygon' ? 'Click to place points · double-click to finish' : 'Hold and drag on the map'}
        </p>
      </div>
      <Separator />
      {draw.phase === 'drawing' && (
        <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={onCancelDrawing}>Cancel Drawing</Button>
      )}
      {(draw.phase === 'configuring' || draw.phase === 'drawn') && (
        <Button size="sm" className="w-full text-xs h-8" onClick={onStartDrawing}>
          {draw.phase === 'drawn' ? 'Redraw' : 'Start Drawing'}
        </Button>
      )}
      {(draw.phase === 'drawn' || draw.phase === 'error') && draw.geometry && (
        <div className="rounded-md bg-muted/60 px-3 py-2 text-[11px] flex items-center gap-2">
          <CheckCircle2 className="size-3.5 text-green-500 shrink-0" />
          <span>Shape ready · <span className="font-medium tabular-nums">{draw.pointCount} pts</span></span>
          <button onClick={() => dispatch({ type: 'CLEAR_SHAPE' })}
            className="ml-auto text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
        </div>
      )}
      {draw.phase === 'drawn'  && <Button size="sm" className="w-full text-xs h-8" onClick={() => void onSave()}>Save to Map</Button>}
      {draw.phase === 'saving' && <Button size="sm" disabled className="w-full text-xs h-8">Saving…</Button>}
      {draw.phase === 'saved' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <CheckCircle2 className="size-3.5" />Saved — layer updated on map
          </div>
          <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => dispatch({ type: 'DRAW_ANOTHER' })}>
            <RotateCcw className="size-3 mr-1.5" />Draw Another
          </Button>
        </div>
      )}
      {draw.phase === 'error' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-1.5 text-xs text-destructive">
            <XCircle className="size-3.5 mt-0.5 shrink-0" /><span>{draw.errorMsg}</span>
          </div>
          <Button size="sm" className="w-full text-xs h-8" onClick={() => void onSave()}>Retry Save</Button>
        </div>
      )}
    </div>
  )
}

// ── Upload panel ──────────────────────────────────────────────────────────────

function UploadPanelContent({
  upload, dispatch, onSave,
}: {
  upload:   ReturnType<typeof zoningUploadReducer>
  dispatch: React.Dispatch<Parameters<typeof zoningUploadReducer>[1]>
  onSave:   () => Promise<void>
}) {
  const locked = upload.phase === 'saving'
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await readFileAsText(file)
    const geom = extractPolygon(text)
    if (!geom) { dispatch({ type: 'CLEAR_FILE' }); return }
    dispatch({ type: 'SET_FILE', fileName: file.name, geometry: geom })
  }
  return (
    <div className="flex flex-col gap-3 p-3 overflow-y-auto flex-1">
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">GeoJSON File</label>
        <label className={cn(
          'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 cursor-pointer transition-colors text-center',
          locked ? 'pointer-events-none opacity-50' : 'hover:border-primary/50 hover:bg-muted/30',
          upload.fileName ? 'border-green-500/50 bg-green-500/5' : 'border-border',
        )}>
          {upload.fileName ? (
            <>
              <FileJson className="size-6 text-green-500" />
              <span className="text-[11px] font-medium text-green-600 break-all">{upload.fileName}</span>
              <button type="button" onClick={e => { e.preventDefault(); dispatch({ type: 'CLEAR_FILE' }) }}
                className="text-[10px] text-muted-foreground hover:text-destructive">Remove</button>
            </>
          ) : (
            <>
              <Upload className="size-5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Click to select a file</span>
              <span className="text-[10px] text-muted-foreground/60">GeoJSON · Polygon geometry</span>
            </>
          )}
          <input type="file" accept=".geojson,.json" className="hidden" disabled={locked}
            onChange={e => void handleFileChange(e)} />
        </label>
      </div>
      <Separator />
      <div className="flex flex-col gap-1.5">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Zone Type</label>
        <select disabled={locked} value={upload.zoneType}
          onChange={e => dispatch({ type: 'SET_ZONE_TYPE', zoneType: e.target.value as ZoneType })}
          className={selectCls}>
          {ZONE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Severity</label>
          <span className="text-xs font-semibold tabular-nums">{upload.severity} / 5</span>
        </div>
        <input type="range" min={1} max={5} step={1} disabled={locked}
          value={upload.severity} onChange={e => dispatch({ type: 'SET_SEVERITY', severity: Number(e.target.value) })}
          className="w-full accent-primary disabled:opacity-50" />
        <div className="flex justify-between text-[9px] text-muted-foreground"><span>Low</span><span>High</span></div>
      </div>
      <Separator />
      {upload.phase === 'idle'   && <Button size="sm" disabled className="w-full text-xs h-8">Select a file first</Button>}
      {upload.phase === 'ready'  && <Button size="sm" className="w-full text-xs h-8" onClick={() => void onSave()}>Save to Map</Button>}
      {upload.phase === 'saving' && <Button size="sm" disabled className="w-full text-xs h-8">Saving…</Button>}
      {upload.phase === 'saved' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <CheckCircle2 className="size-3.5" />Saved — layer updated on map
          </div>
          <Button size="sm" variant="outline" className="w-full text-xs h-8" onClick={() => dispatch({ type: 'RESET' })}>
            <RotateCcw className="size-3 mr-1.5" />Upload Another
          </Button>
        </div>
      )}
      {upload.phase === 'error' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-start gap-1.5 text-xs text-destructive">
            <XCircle className="size-3.5 mt-0.5 shrink-0" /><span>{upload.errorMsg}</span>
          </div>
          <Button size="sm" className="w-full text-xs h-8" onClick={() => void onSave()}>Retry Save</Button>
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function ZoningPage() {
  const navigate = useNavigate()

  const outerCtx = useMapContext()
  const { selectedCity, cityId, cityBoundary } = useCityContext()

  const [engine, setLocalEngine] = useState<MapEngine | null>(null)

  function handleSetEngine(eng: MapEngine | null) {
    setLocalEngine(eng)
  }

  const [drawState,   dispatchDraw]   = useReducer(zoningDrawReducer,   ZONING_DRAW_INITIAL)
  const [uploadState, dispatchUpload] = useReducer(zoningUploadReducer, ZONING_UPLOAD_INITIAL)
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)

  const draw = useDrawPolygon(engine)

  useEffect(() => {
    if (!engine || !cityBoundary) return
    engine.flyToCityBoundary(cityBoundary)
    engine.setCityBoundary(cityBoundary)
  }, [engine, cityBoundary])

  const phaseRef = useRef(drawState.phase)
  phaseRef.current = drawState.phase

  useEffect(() => {
    if (draw.drawnGeometry && phaseRef.current === 'drawing') {
      dispatchDraw({ type: 'SHAPE_DRAWN', geometry: draw.drawnGeometry, pointCount: draw.pointCount })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draw.drawnGeometry])

  function handleTogglePanel(panel: ActivePanel) {
    if (activePanel === panel) { if (panel === 'draw') draw.deactivate(); setActivePanel(null) }
    else { if (activePanel === 'draw') draw.deactivate(); setActivePanel(panel) }
  }

  function handleStartDrawing()  { dispatchDraw({ type: 'START_DRAWING' }); void draw.activate(drawState.drawMode) }
  function handleCancelDrawing() { dispatchDraw({ type: 'CANCEL_DRAWING' }); draw.deactivate() }

  async function saveAndRefresh(body: Record<string, unknown>) {
    if (!cityId) return
    const res = await fetch(`${API_URL}/cities/${cityId}/zoning`, {
      method: 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) { const d = await res.json().catch(() => ({})) as { detail?: string }; throw new Error(d.detail ?? `HTTP ${res.status}`) }
    await fetch(`${API_URL}/cities/${cityId}/zoning/regenerate-pmtiles`, { method: 'POST', credentials: 'include' })
  }

  async function handleDrawSave() {
    if (!drawState.geometry || !cityId) return
    dispatchDraw({ type: 'SAVE_START' })
    try {
      await saveAndRefresh({ city_id: cityId, zone_type: drawState.zoneType, severity: drawState.severity, geometry: drawState.geometry })
      dispatchDraw({ type: 'SAVE_SUCCESS' })
      draw.clearDrawn()
    } catch (err) {
      dispatchDraw({ type: 'SAVE_ERROR', errorMsg: err instanceof Error ? err.message : 'Save failed' })
    }
  }

  async function handleUploadSave() {
    if (!uploadState.geometry || !cityId) return
    dispatchUpload({ type: 'SAVE_START' })
    try {
      await saveAndRefresh({ city_id: cityId, zone_type: uploadState.zoneType, severity: uploadState.severity, geometry: uploadState.geometry })
      dispatchUpload({ type: 'SAVE_SUCCESS' })
    } catch (err) {
      dispatchUpload({ type: 'SAVE_ERROR', errorMsg: err instanceof Error ? err.message : 'Save failed' })
    }
  }

  const localCtx = {
    ...outerCtx,
    engine,
    setEngine: handleSetEngine,
    hazardLayers:        [] as typeof outerCtx.hazardLayers,
    visibleHazardKeys:   new Set<string>(),
    toggleHazard:        () => {},
    zoningPmtileUrl:     null,
    showZoning:          false,
    setShowZoning:       () => {},
    visibleZoningTypes:  null,
    toggleZoningType:    () => {},
    resetZoningTypes:    () => {},
    resetHazardVisibility: () => {},
    clickedZone:         null,
    setClickedZone:      () => {},
    refreshZoningLayer:  async () => {},
    refreshHazardLayers: async () => {},
  }

  return (
    <MapContext.Provider value={localCtx}>
      <div className="relative size-full">
        <Map className="size-full" center={[122.0, 12.0]} zoom={6} pitch={0} />

        {/* Back button */}
        <div className="absolute top-3 left-3 z-10 pointer-events-auto">
          <Button variant="secondary" size="sm"
            className="gap-1.5 shadow-lg bg-background/90 backdrop-blur-md border"
            onClick={() => { draw.deactivate(); void navigate({ to: '/map' as never }) }}>
            <ArrowLeft className="size-3.5" />
            Back to Map
            {selectedCity?.name && <span className="text-muted-foreground text-[11px]">· {selectedCity.name}</span>}
          </Button>
        </div>

        {/* Action controls */}
        <div className="absolute right-3 top-3 bottom-3 z-10 flex items-start gap-2 pointer-events-none">
          {activePanel && (
            <Card className="pointer-events-auto flex flex-col w-64 max-h-full shadow-2xl bg-background/95 backdrop-blur-md border-border/50 animate-in fade-in-0 slide-in-from-right-2 duration-150 overflow-hidden">
              <CardHeader className="pb-0 pt-3 px-3 shrink-0">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xs font-semibold">
                    {activePanel === 'draw' ? 'Draw Zoning Area' : 'Upload GeoJSON'}
                  </CardTitle>
                  <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground"
                    onClick={() => handleTogglePanel(activePanel)}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <Separator className="mt-2 shrink-0" />
              <CardContent className="flex flex-col flex-1 min-h-0 p-0">
                {activePanel === 'draw' ? (
                  <DrawPanelContent draw={drawState} dispatch={dispatchDraw}
                    onStartDrawing={handleStartDrawing} onCancelDrawing={handleCancelDrawing} onSave={handleDrawSave} />
                ) : (
                  <UploadPanelContent upload={uploadState} dispatch={dispatchUpload} onSave={handleUploadSave} />
                )}
              </CardContent>
            </Card>
          )}

          <TooltipProvider delayDuration={400}>
            <div className="pointer-events-auto self-center flex flex-col gap-0.5 rounded-xl bg-black/65 backdrop-blur-md shadow-2xl p-1.5 border border-white/10">
              {PANEL_BUTTONS.map((btn, i) => {
                const Icon     = btn.icon
                const isOcr    = btn.id === 'ocr'
                const isActive = !isOcr && activePanel === btn.id
                return (
                  <div key={btn.id}>
                    {i > 0 && <Separator className="my-0.5 bg-white/10" />}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={btn.label}
                          disabled={isOcr}
                          onClick={() => !isOcr && handleTogglePanel(btn.id as ActivePanel)}
                          className={cn(
                            'size-9 rounded-lg transition-all hover:bg-white/15 text-white/60 hover:text-white',
                            isOcr   && 'text-white/30 disabled:pointer-events-auto cursor-not-allowed',
                            isActive && 'bg-white/20 text-white ring-1 ring-white/30',
                          )}>
                          <Icon className="size-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" sideOffset={8}>
                        {isOcr ? 'OCR + Georeferencing — coming soon' : btn.label}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                )
              })}
            </div>
          </TooltipProvider>
        </div>
      </div>
    </MapContext.Provider>
  )
}
