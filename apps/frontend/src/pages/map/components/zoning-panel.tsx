import { LayoutGrid, Plus, Loader2 } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { useMapContext } from '@/context/map.context'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useZoningPanel } from '../composables/use-zoning-panel'

export function ZoningPanel() {
  const { visibleZoningTypes, toggleZoningType, showZoning, setShowZoning } = useMapContext()
  const { pmtileUrl, zones, zoneTypes, isLoading } = useZoningPanel()
  const navigate = useNavigate()

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
          onClick={() => void navigate({ to: '/zoning' as never })}
        >
          <Plus className="size-3.5" /> Add Zoning Data
        </Button>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {pmtileUrl && (
        <div className="px-3 py-2 shrink-0 flex items-center gap-2">
          <div className="size-2 rounded-full bg-green-500 shrink-0" />
          <span className="text-[11px] text-muted-foreground">Vector tile layer loaded</span>
        </div>
      )}

      <ScrollArea className="flex-1 min-h-0">
        <div className="px-3 py-2 space-y-0">
          <p className="text-[10px] font-medium text-muted-foreground py-1.5 mb-1">
            {zones.length} zone{zones.length !== 1 ? 's' : ''} · {zoneTypes.length} type{zoneTypes.length !== 1 ? 's' : ''}
          </p>

          {zoneTypes.map(([type, count], i) => {
            const filterKey = type === '(unlabelled)' ? '' : type
            const allFilterKeys = zoneTypes.map(([t]) => t === '(unlabelled)' ? '' : t)
            const isVisible = showZoning && (visibleZoningTypes === null || visibleZoningTypes.has(filterKey))
            return (
              <div key={type}>
                {i > 0 && <Separator className="my-0 opacity-30" />}
                <div className="flex items-center gap-2 py-1.5">
                  <span className={cn('text-xs truncate flex-1', !isVisible && 'opacity-40 line-through')}>{type}</span>
                  <span className="text-[10px] tabular-nums text-muted-foreground shrink-0 mr-1">{count}</span>
                  <Switch
                    checked={isVisible}
                    onCheckedChange={() => {
                      if (!showZoning) { setShowZoning(true); return }
                      toggleZoningType(filterKey, allFilterKeys)
                    }}
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