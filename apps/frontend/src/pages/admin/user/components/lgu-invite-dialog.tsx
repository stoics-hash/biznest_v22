import { useState, useRef, type ChangeEvent } from 'react'
import { Copy, Check, Link2, Mail, Building2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Spinner } from '@/components/ui/spinner'
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
} from '@/components/ui/combobox'
import { useLguInvite } from '../composables/use-lgu-invite'

interface LguInviteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
      {copied ? <Check className="size-3.5 text-green-600" /> : <Copy className="size-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

export function LguInviteDialog({ open, onOpenChange }: LguInviteDialogProps) {
  const {
    email, setEmail,
    cityId, setCityId,
    citySearch, setCitySearch,
    cities, citiesLoading,
    sending, error, success, result,
    handleSubmit, reset,
  } = useLguInvite()

  // Prevents the onChange that base-ui fires after selection from re-triggering search
  const justSelectedRef = useRef(false)

  function handleOpenChange(val: boolean) {
    if (!val) reset()
    onOpenChange(val)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send LGU Invitation</DialogTitle>
          <DialogDescription>
            Send a magic-link registration invite to an LGU administrator.
          </DialogDescription>
        </DialogHeader>

        {success && result ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 dark:border-green-900 dark:bg-green-950/30">
              <Check className="size-4 shrink-0 text-green-600" />
              <p className="text-sm text-green-700 dark:text-green-400">{result.message}</p>
            </div>

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground">Magic link</p>
              <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2">
                <Link2 className="size-4 shrink-0 text-muted-foreground" />
                <p className="flex-1 truncate font-mono text-xs text-foreground">{result.magic_link}</p>
                <CopyButton text={result.magic_link} />
              </div>
              <p className="text-xs text-muted-foreground">
                Expires: {new Date(result.expires_at).toLocaleString()}
              </p>
            </div>

            <Button className="w-full" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="lgu@city.gov.ph"
                  required
                  className="pl-8"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>City</Label>
              <Combobox
                value={cityId}
                onValueChange={val => {
                  justSelectedRef.current = true
                  setCityId(val as string | null)
                  setCitySearch('')
                  // Clear flag after base-ui fires its post-selection onChange
                  setTimeout(() => { justSelectedRef.current = false }, 50)
                }}
              >
                <ComboboxInput
                  placeholder="Type at least 2 characters…"
                  showClear={!!cityId}
                  className="w-full"
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    if (!justSelectedRef.current) setCitySearch(e.target.value)
                  }}
                />
                <ComboboxContent>
                  <ComboboxList>
                    {citySearch.length < 2 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        Type to search cities
                      </p>
                    ) : citiesLoading ? (
                      <div className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                        <Spinner className="size-3.5" /> Searching…
                      </div>
                    ) : cities.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        No cities found.
                      </p>
                    ) : (
                      cities.map(city => (
                        <ComboboxItem key={city.id} value={city.name} label={city.name}>
                          <Building2 className="size-4 text-muted-foreground" />
                          <span>{city.name}</span>
                          {city.province && (
                            <span className="ml-auto text-xs text-muted-foreground">{city.province}</span>
                          )}
                        </ComboboxItem>
                      ))
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={sending || !email || !cityId}
            >
              {sending && <Spinner className="mr-2 size-4" />}
              Send invitation
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}