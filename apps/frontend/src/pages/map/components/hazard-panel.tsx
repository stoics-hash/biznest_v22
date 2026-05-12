import { Waves, Mountain, CloudLightning, Zap, Layers } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { HazardTile } from '@/engine/map.engine'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'

export interface HazardMeta {
  label: string
  icon: LucideIcon
  iconColor: string
}

export interface HazardGroup {
  type: string
  meta: HazardMeta
  tiles: HazardTile[]
}

export const HAZARD_META: Record<string, HazardMeta> = {
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

function scenarioLabel(scenario: string | null): string {
  if (!scenario) return 'All Features'
  return SCENARIO_LABELS[scenario] ?? scenario.toUpperCase()
}

export function HazardPanel({
  groups,
  visibleHazardKeys,
  showAllHazards,
  toggleHazard,
  onToggleAll,
  onMasterOn,
}: {
  groups: HazardGroup[]
  visibleHazardKeys: Set<string>
  showAllHazards: boolean
  toggleHazard: (key: string) => void
  onToggleAll: (tiles: HazardTile[], showAll: boolean) => void
  onMasterOn: () => void
}) {
  return (
    <ScrollArea className="flex-1 min-h-0">
      <div className="px-3 pb-3 space-y-1">
        {groups.map((group, gi) => {
          const Icon = group.meta.icon
          const keys = group.tiles.map(t => `${t.hazard_type}::${t.scenario ?? 'all'}`)
          const allOn = showAllHazards && keys.every(k => visibleHazardKeys.has(k))
          const someOn = showAllHazards && keys.some(k => visibleHazardKeys.has(k))

          function handleGroupToggle(checked: boolean) {
            if (!showAllHazards) { onMasterOn(); return }
            onToggleAll(group.tiles, checked)
          }

          return (
            <div key={group.type}>
              {gi > 0 && <Separator className="mb-1" />}

              <div className="flex items-center justify-between py-2 gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon className={cn('size-4 shrink-0', group.meta.iconColor)} />
                  <span className={cn('text-xs font-semibold truncate', !showAllHazards && 'opacity-40')}>{group.meta.label}</span>
                </div>
                <Switch
                  checked={allOn}
                  data-state={someOn && !allOn ? 'indeterminate' : undefined}
                  onCheckedChange={handleGroupToggle}
                  className="shrink-0 scale-90 bg-amber-300"
                />
              </div>

              {group.tiles.length > 1 && (
                <div className="ml-6 space-y-0">
                  {group.tiles.map((tile, ti) => {
                    const key = `${tile.hazard_type}::${tile.scenario ?? 'all'}`
                    const visible = showAllHazards && visibleHazardKeys.has(key)
                    return (
                      <div key={key}>
                        {ti > 0 && <Separator className="my-0 opacity-40" />}
                        <div className="flex items-center justify-between py-2 gap-3">
                          <span className={cn('text-[11px] text-muted-foreground leading-tight', !showAllHazards && 'opacity-40')}>
                            {scenarioLabel(tile.scenario)}
                          </span>
                          <Switch
                            checked={visible}
                            onCheckedChange={() => {
                              if (!showAllHazards) { onMasterOn(); return }
                              toggleHazard(key)
                            }}
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