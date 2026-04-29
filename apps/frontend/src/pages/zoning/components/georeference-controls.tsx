import { useRef } from 'react'
import { Upload, RotateCw, Eye, Save, Trash2, Check, Loader2, AlertCircle, Sparkles } from 'lucide-react'
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
  onProcess: () => void
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

function UploadStatus({ isUploading, isUploaded, uploadError }: Pick<Props, 'isUploading' | 'isUploaded' | 'uploadError'>) {
  if (isUploading) return (
    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
      <Loader2 className="size-3 animate-spin" /> Uploading to server…
    </div>
  )
  if (uploadError) return (
    <div className="flex items-start gap-1.5 text-[10px] text-destructive">
      <AlertCircle className="size-3 mt-px shrink-0" />
      <span>{uploadError}</span>
    </div>
  )
  if (isUploaded) return (
    <div className="flex items-center gap-1.5 text-[10px] text-green-500">
      <Check className="size-3" /> Ready to process
    </div>
  )
  return null
}

function ProcessResult({ processResult, processError, isProcessing }: Pick<Props, 'processResult' | 'processError' | 'isProcessing'>) {
  if (isProcessing) return (
    <div className="rounded-lg bg-muted/50 px-3 py-2.5 flex items-center gap-2 text-xs text-muted-foreground">
      <Loader2 className="size-3.5 animate-spin shrink-0" />
      Processing image — this may take a minute…
    </div>
  )
  if (processError) return (
    <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-xs text-destructive space-y-0.5">
      <p className="font-medium">Processing failed</p>
      <p className="text-[11px] opacity-80">{processError}</p>
    </div>
  )
  if (processResult) return (
    <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2.5 text-xs space-y-0.5">
      <p className="font-medium text-green-600 dark:text-green-400 flex items-center gap-1">
        <Check className="size-3.5" /> Zones extracted
      </p>
      <p className="text-muted-foreground text-[11px]">
        {processResult.zones_created} zone{processResult.zones_created !== 1 ? 's' : ''} created
        {processResult.skipped_zones > 0 && `, ${processResult.skipped_zones} skipped`}
      </p>
    </div>
  )
  return null
}

export function GeoReferenceControls({
  imageUrl, imageName, corners, opacity, rotation, saved,
  isUploading, isUploaded, uploadError,
  isProcessing, processResult, processError,
  onLoad, onRotate, onOpacity, onSave, onClear, onProcess,
}: Props) {
  if (!imageUrl) return <UploadZone onLoad={onLoad} />

  const canProcess = isUploaded && !isProcessing && !!corners

  return (
    <div className="absolute left-3 top-3 bottom-3 z-10 w-60 pointer-events-none">
      <div className="pointer-events-auto flex flex-col h-full rounded-xl bg-background/95 backdrop-blur-md shadow-2xl border border-border/50 overflow-hidden">

        {/* Header */}
        <div className="px-3 pt-3 pb-2 shrink-0 space-y-1.5">
          <p className="text-xs font-semibold truncate" title={imageName ?? undefined}>{imageName}</p>
          <UploadStatus isUploading={isUploading} isUploaded={isUploaded} uploadError={uploadError} />
          <p className="text-[10px] text-muted-foreground">
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

        {/* Process result / status */}
        {(isProcessing || processResult || processError) && (
          <>
            <div className="px-3 py-2.5 shrink-0">
              <ProcessResult isProcessing={isProcessing} processResult={processResult} processError={processError} />
            </div>
            <Separator className="shrink-0" />
          </>
        )}

        {/* Actions */}
        <div className="px-3 py-2.5 flex flex-col gap-2 shrink-0">
          <Button
            size="sm"
            className="w-full"
            onClick={onProcess}
            disabled={!canProcess}
          >
            {isProcessing
              ? <><Loader2 className="size-3.5 animate-spin" /> Processing…</>
              : <><Sparkles className="size-3.5" /> Process Image</>}
          </Button>
          <Button size="sm" variant="outline" className="w-full" onClick={onSave} disabled={saved || !corners || isProcessing}>
            {saved
              ? <><Check className="size-3.5" /> Alignment saved</>
              : <><Save className="size-3.5" /> Save alignment</>}
          </Button>
          <Button size="sm" variant="outline" className="w-full text-destructive hover:text-destructive" onClick={onClear} disabled={isProcessing}>
            <Trash2 className="size-3.5" /> Clear image
          </Button>
        </div>
      </div>
    </div>
  )
}