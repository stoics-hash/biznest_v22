import { AlertTriangle, LayoutGrid, X, Plus, Upload, PenLine, Plug, ScanText, Eye, EyeOff } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useMapContext } from '@/context/map.context'
import { useCityContext } from '@/context/city.context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { HazardPanel, HAZARD_META, type HazardGroup } from './hazard-panel'
import { ZoningPanel } from './zoning-panel'

type ActivePanel = 'hazard' | 'zoning' | null

const STRIP_BUTTONS: { id: NonNullable<ActivePanel>; icon: LucideIcon; label: string }[] = [
  { id: 'hazard', icon: AlertTriangle, label: 'Hazard Layers' },
  { id: 'zoning', icon: LayoutGrid,   label: 'Zoning Layers' },
]

export function HazardControls() {
  const {
    hazardLayers, visibleHazardKeys, toggleHazard, engine, zoningPmtileUrl,
    showZoning, setShowZoning,
    showAllHazards, setShowAllHazards,
    visibleZoningTypes, resetZoningTypes, resetHazardVisibility,
  } = useMapContext()
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
  const hasZoning  = !!zoningPmtileUrl || !!selectedCity?.id

  const hazardAllVisible = showAllHazards && visibleHazardKeys.size > 0
  const zoningAllVisible = showZoning && (visibleZoningTypes === null || visibleZoningTypes.size > 0)
  const panelVisible = activePanel === 'hazard' ? hazardAllVisible : zoningAllVisible

  function handleHeaderVisibilityToggle() {
    if (activePanel === 'hazard') {
      if (hazardAllVisible) {
        setShowAllHazards(false)
      } else {
        setShowAllHazards(true)
        if (visibleHazardKeys.size === 0) resetHazardVisibility()
      }
    } else {
      if (zoningAllVisible) {
        setShowZoning(false)
      } else {
        setShowZoning(true)
        if (visibleZoningTypes !== null && visibleZoningTypes.size === 0) resetZoningTypes()
      }
    }
  }

  function handleToggleAll(tiles: HazardGroup['tiles'], showAll: boolean) {
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

  const disabled: Record<NonNullable<ActivePanel>, boolean> = {
    hazard: !hasHazards,
    zoning: !hasZoning,
  }

  return (
    <div className="absolute right-3 top-3 bottom-3 flex items-start gap-2 z-10 pointer-events-none">

      {activePanel && (
        <Card className="pointer-events-auto flex flex-col w-60 h-full shadow-2xl bg-background/95 backdrop-blur-md border-border/50 animate-in fade-in-0 slide-in-from-right-2 duration-150">
          <CardHeader className="pb-0 pt-3 px-3 shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                {activePanel === 'hazard' ? 'Hazard Layers' : 'Zoning Layers'}
              </CardTitle>
              <div className="flex items-center gap-0.5 -mr-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 text-muted-foreground hover:text-foreground"
                  onClick={handleHeaderVisibilityToggle}
                >
                  {panelVisible ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </Button>
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
                showAllHazards={showAllHazards}
                toggleHazard={toggleHazard}
                onToggleAll={handleToggleAll}
                onMasterOn={() => setShowAllHazards(true)}
              />
            ) : (
              <ZoningPanel />
            )}
          </CardContent>
        </Card>
      )}

      <TooltipProvider delayDuration={400}>
        <div className="pointer-events-auto self-center flex flex-col gap-0.5 rounded-xl bg-black/65 backdrop-blur-md shadow-2xl p-1.5 border border-white/10">
          {STRIP_BUTTONS.map((btn, i) => {
            const Icon = btn.icon
            const isActive = activePanel === btn.id
            const isDisabled = disabled[btn.id]
            return (
              <div key={btn.id}>
                {i > 0 && <Separator className="my-0.5 bg-white/10" />}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={btn.label}
                      disabled={isDisabled}
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
                    {isDisabled ? `${btn.label} — no data` : btn.label}
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