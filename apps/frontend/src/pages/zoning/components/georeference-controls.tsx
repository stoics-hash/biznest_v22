import { useRef } from 'react'
import { Upload, RotateCw, Eye, Save, Trash2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import type { GeoreferenceState } from '../composables/use-georeference'
import type { ImageCorners } from '@/engine/map.engine'

const CORNER_LABELS = ['TL', 'TR', 'BR', 'BL'] as const
const CORNER_COLORS = ['text-red-400', 'text-blue-400', 'text-green-400', 'text-amber-400']

interface Props extends GeoreferenceState {
  onLoad: (file: File) => void
  onRotate: (deg: number) => void
  onOpacity: (v: number) => void
  onSave: () => void
  onClear: () => void
}

function CornerRow({ label, color, corner }: { label: string; color: string; corner: [number, number] }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className={`text-[10px] font-bold font-mono w-5 shrink-0 ${color}`}>{label}</span>
      <span className="text-[10px] font-mono text-muted-foreground leading-tight">
        {corner[0].toFixed(5)}, {corner[1].toFixed(5)}
      </span>
    </div>
  )
}

function UploadZone({ onLoad }: { onLoad: (f: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file && file.type.startsWith('image/')) onLoad(file)
  }

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
      <div
        className="pointer-events-auto flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-white/30 bg-black/60 backdrop-blur-md px-10 py-8 text-white shadow-2xl cursor-pointer hover:border-white/50 hover:bg-black/70 transition-colors"
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        <Upload className="size-8 text-white/60" />
        <div className="text-center">
          <p className="text-sm font-semibold">Upload zoning map image</p>
          <p className="text-xs text-white/50 mt-0.5">Drag & drop or click · PNG, JPG, TIFF</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onLoad(f) }}
        />
      </div>
    </div>
  )
}

export function GeoReferenceControls({
  imageUrl, imageName, corners, opacity, rotation, saved,
  onLoad, onRotate, onOpacity, onSave, onClear,
}: Props) {
  if (!imageUrl) return <UploadZone onLoad={onLoad} />

  return (
    <div className="absolute left-3 top-3 bottom-3 z-10 w-60 pointer-events-none">
      <div className="pointer-events-auto flex flex-col h-full rounded-xl bg-background/95 backdrop-blur-md shadow-2xl border border-border/50 overflow-hidden">

        {/* Header */}
        <div className="px-3 pt-3 pb-2 shrink-0">
          <p className="text-xs font-semibold truncate" title={imageName ?? undefined}>{imageName}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Drag corner handles on map to align
          </p>
        </div>

        <Separator className="shrink-0" />

        {/* Sliders */}
        <div className="px-3 py-3 space-y-4 shrink-0">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <Eye className="size-3" /> Opacity
              </Label>
              <span className="text-[11px] tabular-nums text-muted-foreground">{Math.round(opacity * 100)}%</span>
            </div>
            <Slider value={[opacity]} min={0} max={1} step={0.05} onValueChange={([v]) => onOpacity(v)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <RotateCw className="size-3" /> Rotation
              </Label>
              <span className="text-[11px] tabular-nums text-muted-foreground">{rotation}°</span>
            </div>
            <Slider value={[rotation]} min={-180} max={180} step={1} onValueChange={([v]) => onRotate(v)} />
          </div>
        </div>

        <Separator className="shrink-0" />

        {/* Corner coordinates */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2">
          <p className="text-[10px] font-medium text-muted-foreground mb-1">Corner coordinates</p>
          {corners
            ? (corners as ImageCorners).map((corner, i) => (
                <CornerRow
                  key={CORNER_LABELS[i]}
                  label={CORNER_LABELS[i]}
                  color={CORNER_COLORS[i]}
                  corner={corner}
                />
              ))
            : <p className="text-[10px] text-muted-foreground">No corners set</p>
          }
        </div>

        <Separator className="shrink-0" />

        {/* Actions */}
        <div className="px-3 py-2.5 flex flex-col gap-2 shrink-0">
          <Button size="sm" className="w-full" onClick={onSave} disabled={saved || !corners}>
            {saved
              ? <><Check className="size-3.5" /> Alignment saved</>
              : <><Save className="size-3.5" /> Save alignment</>}
          </Button>
          <Button size="sm" variant="outline" className="w-full text-destructive hover:text-destructive" onClick={onClear}>
            <Trash2 className="size-3.5" /> Clear image
          </Button>
        </div>
      </div>
    </div>
  )
}