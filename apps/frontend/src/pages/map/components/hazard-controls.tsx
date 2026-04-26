import { useState } from 'react'
import { Waves, Mountain, CloudLightning, Zap, Layers, X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMapContext } from '@/context/map.context'
import type { HazardTile } from '@/engine/map.engine'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

// ── Config ────────────────────────────────────────────────────────────────────

interface HazardMeta {
  label: string
  icon: LucideIcon
  iconColor: string
  activeRing: string
}

const HAZARD_META: Record<string, HazardMeta> = {
  flood:       { label: 'Flood',        icon: Waves,          iconColor: 'text-blue-400',   activeRing: 'ring-blue-400/50'   },
  landslide:   { label: 'Landslide',    icon: Mountain,       iconColor: 'text-orange-400', activeRing: 'ring-orange-400/50' },
  storm_surge: { label: 'Storm Surge',  icon: CloudLightning, iconColor: 'text-purple-400', activeRing: 'ring-purple-400/50' },
  debris_flow: { label: 'Debris Flow',  icon: Layers,         iconColor: 'text-amber-500',  activeRing: 'ring-amber-500/50'  },
  faultline:   { label: 'Faultline',    icon: Zap,            iconColor: 'text-red-400',    activeRing: 'ring-red-400/50'    },
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

function scenarioLabel(scenario: string | null): string {
  if (!scenario) return 'All Features'
  return SCENARIO_LABELS[scenario] ?? scenario.toUpperCase()
}

// ── Component ─────────────────────────────────────────────────────────────────

export function HazardControls() {
  const { hazardLayers, visibleHazardKeys, toggleHazard, engine } = useMapContext()
  const [activeType, setActiveType] = useState<string | null>(null)

  // Group tiles by hazard_type, in HAZARD_META display order
  const groups = hazardLayers.reduce<Record<string, HazardTile[]>>((acc, tile) => {
    ;(acc[tile.hazard_type] ??= []).push(tile)
    return acc
  }, {})

  const orderedTypes = Object.keys(HAZARD_META).filter(t => t in groups)

  if (orderedTypes.length === 0) return null

  const activeMeta  = activeType ? HAZARD_META[activeType] : null
  const activeTiles = activeType ? (groups[activeType] ?? []) : []

  function handleIconClick(type: string) {
    setActiveType(prev => (prev === type ? null : type))
  }

  return (
    // Outer container: centered vertically on the right edge, above MapLibre controls
    <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-2 z-10 pointer-events-none">

      {/* ── Scenario panel ─────────────────────────────────────────────────── */}
      {activeType && activeMeta && activeTiles.length > 0 && (
        <Card className="pointer-events-auto w-56 shadow-2xl bg-background/95 backdrop-blur-md border-border/50 animate-in fade-in-0 slide-in-from-right-2 duration-150">
          <CardHeader className="pb-0 pt-3 px-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <activeMeta.icon className={cn('size-4 shrink-0', activeMeta.iconColor)} />
                {activeMeta.label}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="size-6 text-muted-foreground hover:text-foreground -mr-1"
                onClick={() => setActiveType(null)}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          </CardHeader>

          <Separator className="mt-2" />

          <CardContent className="px-3 py-3 space-y-0">
            {activeTiles.map((tile, i) => {
              const key     = engine?.hazardKey(tile) ?? ''
              const visible = visibleHazardKeys.has(key)
              return (
                <div key={key}>
                  {i > 0 && <Separator className="my-0" />}
                  <div className="flex items-center justify-between py-2.5 gap-3">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs font-medium leading-tight truncate">
                        {scenarioLabel(tile.scenario)}
                      </span>
                      {tile.scenario && (
                        <span className="text-[10px] text-muted-foreground leading-tight">
                          Return period
                        </span>
                      )}
                    </div>
                    <Switch
                      checked={visible}
                      onCheckedChange={() => toggleHazard(key)}
                      className="shrink-0"
                    />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* ── Icon strip ─────────────────────────────────────────────────────── */}
      <TooltipProvider delayDuration={400}>
        <div className="pointer-events-auto flex flex-col gap-0.5 rounded-xl bg-black/65 backdrop-blur-md shadow-2xl p-1.5 border border-white/10">
          {orderedTypes.map((type, i) => {
            const meta     = HAZARD_META[type]!
            const Icon     = meta.icon
            const isActive = activeType === type

            return (
              <div key={type}>
                {i > 0 && <Separator className="my-0.5 bg-white/10" />}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={meta.label}
                      onClick={() => handleIconClick(type)}
                      className={cn(
                        'size-9 rounded-lg transition-all',
                        'hover:bg-white/15 text-white/60 hover:text-white',
                        isActive && cn(
                          'bg-white/20 text-white ring-1',
                          meta.activeRing,
                        ),
                      )}
                    >
                      <Icon className={cn('size-5', meta.iconColor)} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" sideOffset={8}>
                    {meta.label}
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