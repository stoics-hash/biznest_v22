import { useState, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, X, PenLine } from 'lucide-react'
import { useMapContext } from '@/context/map.context'
import { useCityContext } from '@/context/city.context'
import {
  useUpdateZoningAreaCitiesCityIdZoningZoneIdPatch,
  useRegenerateZoningPmtilesCitiesCityIdZoningRegeneratePmtilesPost,
  getListZoningAreasCitiesCityIdZoningGetQueryKey,
  getGetZoningPmtilesCitiesCityIdZoningPmtilesGetQueryKey,
} from '@networking/api/generated/zoning/zoning'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function ZoneEditPopup() {
  const { engine, clickedZone, setClickedZone, refreshZoningLayer } = useMapContext()
  const { selectedCity } = useCityContext()
  const queryClient = useQueryClient()

  const [label, setLabel] = useState('')
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync label + focus when a new zone is selected
  useEffect(() => {
    if (!clickedZone) { setError(null); return }
    setLabel(clickedZone.zoneType)
    setError(null)
    setTimeout(() => inputRef.current?.select(), 50)
  }, [clickedZone?.id])

  // Project lngLat → screen pixel, re-sync on map move/zoom
  useEffect(() => {
    if (!engine || !clickedZone) { setPos(null); return }
    const update = () => {
      const p = engine.instance.project([clickedZone.lngLat.lng, clickedZone.lngLat.lat])
      setPos({ x: p.x, y: p.y })
    }
    update()
    engine.instance.on('move', update)
    engine.instance.on('zoom', update)
    engine.instance.on('resize', update)
    return () => {
      engine.instance.off('move', update)
      engine.instance.off('zoom', update)
      engine.instance.off('resize', update)
    }
  }, [engine, clickedZone])

  const { mutateAsync: patchZone, isPending: patching } = useUpdateZoningAreaCitiesCityIdZoningZoneIdPatch()
  const { mutateAsync: regenerate, isPending: regenerating } = useRegenerateZoningPmtilesCitiesCityIdZoningRegeneratePmtilesPost()
  const isBusy = patching || regenerating

  if (!clickedZone || !pos) return null

  async function handleSave() {
    if (!selectedCity || !clickedZone) return
    const trimmed = label.trim()
    if (!trimmed) return
    setError(null)
    try {
      await patchZone({ cityId: selectedCity.id, zoneId: clickedZone.id, data: { zone_type: trimmed } })
      const res = await regenerate({ cityId: selectedCity.id })
      await refreshZoningLayer(res.data.pmtile_url)
      queryClient.invalidateQueries({ queryKey: getListZoningAreasCitiesCityIdZoningGetQueryKey(selectedCity.id) })
      queryClient.invalidateQueries({ queryKey: getGetZoningPmtilesCitiesCityIdZoningPmtilesGetQueryKey(selectedCity.id) })
      setClickedZone(null)
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(typeof detail === 'string' ? detail : 'Save failed')
    }
  }

  return (
    <div
      className="absolute z-20 pointer-events-auto"
      style={{
        left: pos.x,
        top: pos.y,
        transform: 'translate(-50%, calc(-100% - 14px))',
      }}
    >
      {/* Popup card */}
      <div className="bg-popover border border-border rounded-lg shadow-xl p-3 w-56 space-y-2.5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold flex items-center gap-1.5">
            <PenLine className="size-3.5 text-muted-foreground" /> Edit zone type
          </span>
          <button
            className="text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setClickedZone(null)}
            aria-label="Close"
          >
            <X className="size-3.5" />
          </button>
        </div>

        {/* Input */}
        <Input
          ref={inputRef}
          value={label}
          onChange={e => setLabel(e.target.value)}
          placeholder="e.g. Agricultural"
          className="h-7 text-xs"
          disabled={isBusy}
          onKeyDown={e => {
            if (e.key === 'Enter') void handleSave()
            if (e.key === 'Escape') setClickedZone(null)
          }}
        />

        {/* Status */}
        {regenerating && (
          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Loader2 className="size-3 animate-spin" /> Rebuilding PMTile…
          </p>
        )}
        {error && (
          <p className="text-[10px] text-destructive">{error}</p>
        )}

        {/* Actions */}
        <div className="flex gap-1.5">
          <Button
            size="sm"
            className="flex-1 h-7 text-xs gap-1"
            onClick={handleSave}
            disabled={isBusy || !label.trim() || label.trim() === clickedZone.zoneType}
          >
            {isBusy
              ? <Loader2 className="size-3 animate-spin" />
              : <><Check className="size-3" /> Save</>}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => setClickedZone(null)}
            disabled={isBusy}
          >
            Cancel
          </Button>
        </div>
      </div>

      {/* Down-pointing arrow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-x-[5px] border-x-transparent border-t-[5px] border-t-border" />
      <div className="absolute bottom-px left-1/2 -translate-x-1/2 translate-y-full w-0 h-0 border-x-[4px] border-x-transparent border-t-[4px] border-t-popover" />
    </div>
  )
}