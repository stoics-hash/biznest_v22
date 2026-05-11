import { AlertTriangle, LayoutGrid, Waves, Mountain, CloudLightning, Zap, Layers, X, Plus, Upload, PenLine, Plug, ScanText, Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useMapContext } from '@/context/map.context'
import { useCityContext } from '@/context/city.context'
import type { HazardTile } from '@/engine/map.engine'
import { useListZoningAreasCitiesCityIdZoningGet, useGetZoningPmtilesCitiesCityIdZoningPmtilesGet } from '@networking/api/generated/zoning/zoning'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// ── Config ────────────────────────────────────────────────────────────────────

interface HazardMeta {
  label: string
  icon: LucideIcon
  iconColor: string
}

const HAZARD_META: Record<string, HazardMeta> = {
  flood:       { label: 'Flood',       icon: Waves,          iconColor: 'text-blue-400'   },
  landslide:   { label: 'Landslide',   icon: Mountain,       iconColor: 'text-orange-400' },
  storm_surge: { label: 'Storm Surge', icon: CloudLightning, iconColor: 'text-purple-400' },
  debris_flow: { label: 'Debris Flow', icon: Layers,         iconColor: 'text-amber-500'  },
  faultline:   { label: 'Faultline',   icon: Zap,            iconColor: 'text-red-400'    },
}

const SCENARIO_LABELS: Record<string, string> = {
  '5yr':   '5-Year Return',
  '25yr':  '25-Year Return',
  '100yr': '100-Year Return',
  'ssa1':  'SSA Level 1',
  'ssa2':  'SSA Level 2',
  'ssa3':  'SSA Level 3',
  'ssa4':  'SSA Level 4',
}

// Stable color per zone_type string using a simple hash.
const ZONE_PALETTE = ['#10b981','#3b82f6','#f97316','#8b5cf6','#ef4444','#eab308','#06b6d4','#84cc16','#ec4899','#14b8a6']
function zoneColor(type: string): string {
  let h = 0
  for (let i = 0; i < type.length; i++) h = (h * 31 + type.charCodeAt(i)) & 0xffff
  return ZONE_PALETTE[h % ZONE_PALETTE.length]
}
// If zone_type is itself a hex color (backend fallback when OCR not configured), use it directly.
function swatchColor(type: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(type) ? type : zoneColor(type)
}

function scenarioLabel(scenario: string | null): string {
  if (!scenario) return 'All Features'
  return SCENARIO_LABELS[scenario] ?? scenario.toUpperCase()
}

type ActivePanel = 'hazard' | 'zoning' | null

// ── Hazard panel ──────────────────────────────────────────────────────────────

interface HazardGroup {
  type: string
  meta: HazardMeta
  tiles: HazardTile[]
}

function HazardPanel({
  groups,
  visibleHazardKeys,
  toggleHazard,
  onToggleAll,
}: {
  groups: HazardGroup[]
  visibleHazardKeys: Set<string>
  toggleHazard: (key: string) => void
  onToggleAll: (tiles: HazardTile[], showAll: boolean) => void
}) {
  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="px-3 pb-3 space-y-1">
        {groups.map((group, gi) => {
          const Icon = group.meta.icon
          const keys = group.tiles.map(t => `${t.hazard_type}::${t.scenario ?? 'all'}`)
          const allOn = keys.every(k => visibleHazardKeys.has(k))
          const someOn = keys.some(k => visibleHazardKeys.has(k))

          return (
            <div key={group.type}>
              {gi > 0 && <Separator className="mb-1" />}

              {/* Type header row */}
              <div className="flex items-center justify-between py-2 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={cn('size-4 shrink-0', group.meta.iconColor)} />
                  <span className="text-xs font-semibold truncate">{group.meta.label}</span>
                </div>
                <Switch
                  checked={allOn}
                  data-state={someOn && !allOn ? 'indeterminate' : undefined}
                  onCheckedChange={checked => onToggleAll(group.tiles, checked)}
                  className="shrink-0 scale-90 bg-amber-300"
                />
              </div>

              {/* Scenario sub-rows */}
              {group.tiles.length > 1 && (
                <div className="ml-6 space-y-0">
                  {group.tiles.map((tile, ti) => {
                    const key = `${tile.hazard_type}::${tile.scenario ?? 'all'}`
                    const visible = visibleHazardKeys.has(key)
                    return (
                      <div key={key}>
                        {ti > 0 && <Separator className="my-0 opacity-40" />}
                        <div className="flex items-center justify-between py-2 gap-3">
                          <span className="text-[11px] text-muted-foreground leading-tight">
                            {scenarioLabel(tile.scenario)}
                          </span>
                          <Switch
                            checked={visible}
                            onCheckedChange={() => toggleHazard(key)}
                            className="shrink-0 scale-75"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}

// ── Zoning panel ──────────────────────────────────────────────────────────────

function ZoningPanel() {
  const { showZoning, setShowZoning, visibleZoningTypes, toggleZoningType } = useMapContext()
  const { selectedCity } = useCityContext()
  const navigate = useNavigate()

  const { data: pmtilesRes, isLoading: pmtilesLoading } = useGetZoningPmtilesCitiesCityIdZoningPmtilesGet(
    selectedCity?.id ?? '',
    { query: { enabled: !!selectedCity?.id, retry: false } },
  )
  const pmtileUrl = pmtilesRes?.data?.pmtile_url ?? null

  const { data, isLoading: zonesLoading } = useListZoningAreasCitiesCityIdZoningGet(
    selectedCity?.id ?? '',
    { query: { enabled: !!selectedCity?.id } },
  )
  const zones = data?.data ?? []
  const isLoading = pmtilesLoading || zonesLoading

  const grouped = zones.reduce<Record<string, number>>((acc, z) => {
    const key = z.zone_type ?? '(unlabelled)'
    acc[key] = (acc[key] ?? 0) + 1
    return acc
  }, {})
  const zoneTypes = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))

  if (isLoading) return (
    <div className="flex flex-1 items-center justify-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin" /> Loading zones…
    </div>
  )

  if (!pmtileUrl && zones.length === 0) return (
    <div className="flex flex-1 items-center justify-center px-4 text-center">
      <div className="space-y-2.5">
        <LayoutGrid className="mx-auto size-8 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          No zoning data for this city yet.
        </p>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1.5"
          onClick={() => void navigate({ to: '/zoning/zoning-map' as never })}
        >
          <ScanText className="size-3.5" /> OCR + Georeferencing
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Master toggle */}
      <div className="px-3 py-2.5 flex items-center justify-between shrink-0">
        <span className="text-xs font-medium">Show zoning overlay</span>
        <Switch
          checked={showZoning}
          onCheckedChange={setShowZoning}
          className="scale-90"
          disabled={!pmtileUrl}
        />
      </div>

      <Separator className="shrink-0" />

      {/* PMTile layer status */}
      {pmtileUrl && (
        <div className="px-3 py-2 shrink-0 flex items-center gap-2">
          <div className="size-2 rounded-full bg-green-500 shrink-0" />
          <span className="text-[11px] text-muted-foreground">Vector tile layer loaded</span>
        </div>
      )}

      {/* Zone type list with per-type visibility toggles */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-2 space-y-0">
          {/* Header row: count + toggle-all */}
          <div className="flex items-center justify-between py-1.5 mb-1">
            <p className="text-[10px] font-medium text-muted-foreground">
              {zones.length} zone{zones.length !== 1 ? 's' : ''} · {zoneTypes.length} type{zoneTypes.length !== 1 ? 's' : ''}
            </p>
            <button
              className="text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              onClick={() => {
                const allTypes = zoneTypes.map(([t]) => t === '(unlabelled)' ? '' : t)
                const allVisible = visibleZoningTypes === null
                // Toggle all off → pick first type to trigger the expand logic
                if (allVisible) {
                  allTypes.forEach(t => toggleZoningType(t, allTypes))
                } else {
                  // Reset to all visible
                  allTypes.forEach(t => {
                    if (!visibleZoningTypes!.has(t)) toggleZoningType(t, allTypes)
                  })
                }
              }}
            >
              {visibleZoningTypes === null ? 'Hide all' : 'Show all'}
            </button>
          </div>

          {zoneTypes.map(([type, count], i) => {
            const filterKey = type === '(unlabelled)' ? '' : type
            const allFilterKeys = zoneTypes.map(([t]) => t === '(unlabelled)' ? '' : t)
            const isVisible = visibleZoningTypes === null || visibleZoningTypes.has(filterKey)
            return (
              <div key={type}>
                {i > 0 && <Separator className="my-0 opacity-30" />}
                <div className="flex items-center gap-2 py-1.5">
                  <span
                    className="size-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: swatchColor(type) }}
                  />
                  <span className={cn('text-xs truncate flex-1', !isVisible && 'opacity-40 line-through')}>{type}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground shrink-0 mr-1">{count}</span>
                  <Switch
                    checked={isVisible}
                    onCheckedChange={() => toggleZoningType(filterKey, allFilterKeys)}
                    className="shrink-0 scale-75"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}

// ── Root ─────────────────────────────────────────────────────────────────────

export function HazardControls() {
  const { hazardLayers, visibleHazardKeys, toggleHazard, engine, zoningPmtileUrl } = useMapContext()
  const { selectedCity } = useCityContext()
  const [activePanel, setActivePanel] = useState<ActivePanel>(null)
  const navigate = useNavigate()

  const groups: HazardGroup[] = Object.entries(HAZARD_META)
    .filter(([type]) => hazardLayers.some(t => t.hazard_type === type))
    .map(([type, meta]) => ({
      type,
      meta,
      tiles: hazardLayers.filter(t => t.hazard_type === type),
    }))

  const hasHazards = groups.length > 0
  const hasZoning  = !!zoningPmtileUrl || !!selectedCity?.id  // always show button when city selected

  function handleToggleAll(tiles: HazardTile[], showAll: boolean) {
    for (const tile of tiles) {
      const key = engine?.hazardKey(tile) ?? `${tile.hazard_type}::${tile.scenario ?? 'all'}`
      const visible = visibleHazardKeys.has(key)
      if (showAll && !visible) toggleHazard(key)
      else if (!showAll && visible) toggleHazard(key)
    }
  }

  function togglePanel(panel: ActivePanel) {
    setActivePanel(prev => (prev === panel ? null : panel))
  }

  const stripButtons: { id: ActivePanel; icon: LucideIcon; label: string; disabled?: boolean }[] = [
    { id: 'hazard', icon: AlertTriangle, label: 'Hazard Layers', disabled: !hasHazards },
    { id: 'zoning', icon: LayoutGrid,   label: 'Zoning Layers', disabled: !hasZoning  },
  ]

  return (
    <div className="absolute right-3 top-3 bottom-3 flex items-start gap-2 z-10 pointer-events-none">

      {/* ── Expanded side panel ──────────────────────────────────────────── */}
      {activePanel && (
        <Card className="pointer-events-auto flex flex-col w-60 h-full shadow-2xl bg-background/95 backdrop-blur-md border-border/50 animate-in fade-in-0 slide-in-from-right-2 duration-150">
          <CardHeader className="pb-0 pt-3 px-3 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                {activePanel === 'hazard' ? 'Hazard Layers' : 'Zoning Layers'}
              </CardTitle>
              <div className="flex items-center gap-0.5 -mr-1">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-6 text-muted-foreground hover:text-foreground">
                      <Plus className="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" side="bottom" className="w-52">
                    {activePanel === 'hazard' ? (
                      <>
                        <DropdownMenuLabel className="text-xs">Add Hazard Data</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <Upload className="size-4" />
                          Upload file
                          <span className="ml-auto text-[10px] text-muted-foreground">GeoJSON / ZIP</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <PenLine className="size-4" />
                          Manual entry
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Plug className="size-4" />
                          Through API
                        </DropdownMenuItem>
                      </>
                    ) : (
                      <>
                        <DropdownMenuLabel className="text-xs">Add Zoning Data</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => void navigate({ to: '/zoning/zoning-map' as never })}>
                          <ScanText className="size-4" />
                          OCR + Georeferencing
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <PenLine className="size-4" />
                          Manual entry
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  onClick={() => setActivePanel(null)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <Separator className="mt-2 shrink-0" />

          <CardContent className="flex flex-col flex-1 min-h-0 p-0">
            {activePanel === 'hazard' ? (
              <HazardPanel
                groups={groups}
                visibleHazardKeys={visibleHazardKeys}
                toggleHazard={toggleHazard}
                onToggleAll={handleToggleAll}
              />
            ) : (
              <ZoningPanel />
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Icon strip ───────────────────────────────────────────────────── */}
      <TooltipProvider delayDuration={400}>
        <div className="pointer-events-auto self-center flex flex-col gap-0.5 rounded-xl bg-black/65 backdrop-blur-md shadow-2xl p-1.5 border border-white/10">
          {stripButtons.map((btn, i) => {
            const Icon = btn.icon
            const isActive = activePanel === btn.id
            return (
              <div key={btn.id}>
                {i > 0 && <Separator className="my-0.5 bg-white/10" />}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={btn.label}
                      disabled={btn.disabled}
                      onClick={() => togglePanel(btn.id)}
                      className={cn(
                        'size-9 rounded-lg transition-all',
                        'hover:bg-white/15 text-white/60 hover:text-white',
                        'disabled:opacity-30 disabled:pointer-events-none',
                        isActive && 'bg-white/20 text-white ring-1 ring-white/30',
                      )}
                    >
                      <Icon className="size-5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={8}>
                    {btn.disabled ? `${btn.label} — no data` : btn.label}
                  </TooltipContent>
                </Tooltip>
              </div>
            )
          })}
        </div>
      </TooltipProvider>
    </div>
  )
}