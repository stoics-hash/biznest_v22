import {useMemo, useState} from 'react'
import {ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Lock, Map, MapPin, Search} from 'lucide-react'
import {Spinner} from '@/components/ui/spinner'
import {Badge} from '@/components/ui/badge'
import {Button} from '@/components/ui/button'
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from '@/components/ui/card'
import {Input} from '@/components/ui/input'
import type {CityResponse} from '@networking/api/model/cityResponse'
import {useCitySetup} from './composables/use-city-setup'
import {CreateCityDialog} from './components/create-city-dialog'

const PAGE_SIZE = 10

function CityCard({
  city,
  joined,
  actionLabel,
  actionDisabled,
  actionLoading,
  onAction,
}: {
  city: CityResponse
  joined: boolean
  actionLabel: string
  actionDisabled?: boolean
  actionLoading?: boolean
  onAction: () => void
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <MapPin className="size-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{city.name}</p>
          {(city.province || city.region) && (
            <p className="text-xs text-muted-foreground truncate">
              {[city.province, city.region].filter(Boolean).join(', ')}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {joined ? (
          <>
            <CheckCircle2 className="size-4 text-green-500" />
            <Button size="sm" variant="outline" onClick={onAction}>
              Enter
              <ArrowRight className="ml-1.5 size-3.5" />
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            disabled={actionDisabled || actionLoading}
            onClick={onAction}
          >
            {actionLoading ? (
              <Spinner className="size-3.5 mr-1.5" />
            ) : actionDisabled ? (
              <Lock className="size-3.5 mr-1.5" />
            ) : null}
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  )
}

export function CitySetupPage() {
  const {
    role,
    user,
    myCities,
    availableCities,
    subscription,
    atLimit,
    maxCities,
    usedSlots,
    loading,
    subscribeCity,
    claimCity,
    createCity,
    enterCity,
  } = useCitySetup()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const isInvestor = role === 'investor'
  const isLgu = role === 'lgu_admin'

  const actionLabel = isInvestor ? 'Subscribe' : 'Claim'
  const actionMutation = isInvestor ? subscribeCity : claimCity

  const filteredCities = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return availableCities
    return availableCities.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.province?.toLowerCase().includes(q) ||
      c.region?.toLowerCase().includes(q),
    )
  }, [availableCities, search])

  const totalPages = Math.max(1, Math.ceil(filteredCities.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const pageSlice = filteredCities.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  function handleSearch(value: string) {
    setSearch(value)
    setPage(1)
  }

  return (
    <div className="flex flex-1 items-start justify-center px-4 py-12">
        <div className="w-full max-w-2xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-1">
            <div className="flex justify-center mb-3">
              <div className="rounded-full bg-primary/10 p-3">
                <Map className="size-6 text-primary" />
              </div>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome, {user?.full_name ?? user?.email}
            </h1>
            <p className="text-sm text-muted-foreground">
              {isInvestor
                ? 'Subscribe to cities to access geo-intelligence data'
                : isLgu
                  ? 'Manage your assigned cities or create a new one'
                  : 'Choose a city to get started'}
            </p>
          </div>

          {/* Subscription limit bar (investor only) */}
          {isInvestor && subscription && maxCities !== null && (
            <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-2.5 text-sm">
              <span className="text-muted-foreground">
                City slots used:&nbsp;
                <span className={atLimit ? 'text-destructive font-medium' : 'font-medium text-foreground'}>
                  {usedSlots} / {maxCities}
                </span>
              </span>
              <Badge variant={atLimit ? 'destructive' : 'secondary'} className="capitalize">
                {subscription.plan.name}
              </Badge>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Loading cities…
            </div>
          ) : (
            <>
              {/* My Cities */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base">
                      {isLgu ? 'Assigned Cities' : 'My Cities'}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Cities you already have access to
                    </CardDescription>
                  </div>
                  {isLgu && (
                    <CreateCityDialog mutation={createCity} />
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  {myCities.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">
                      {isInvestor
                        ? 'No subscriptions yet. Subscribe to a city below.'
                        : isLgu
                          ? 'No cities assigned yet. Create one or claim an existing city below.'
                          : 'No cities yet.'}
                    </p>
                  ) : (
                    myCities.map(city => (
                      <CityCard
                        key={city.id}
                        city={city}
                        joined={true}
                        actionLabel="Enter"
                        onAction={() => void enterCity(city.id)}
                      />
                    ))
                  )}
                </CardContent>
              </Card>

              {/* Available Cities */}
              {availableCities.length > 0 && (
                <Card>
                  <CardHeader className="pb-3 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base">Available Cities</CardTitle>
                        <CardDescription className="text-xs">
                          {isInvestor
                            ? atLimit
                              ? 'Upgrade your subscription to access more cities'
                              : 'Subscribe to add a city to your plan'
                            : 'Claim a city to become its LGU admin'}
                        </CardDescription>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 pt-0.5">
                        {filteredCities.length} of {availableCities.length}
                      </span>
                    </div>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
                      <Input
                        placeholder="Search by city, province or region…"
                        value={search}
                        onChange={e => handleSearch(e.target.value)}
                        className="pl-8 h-8 text-sm"
                      />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pageSlice.length === 0 ? (
                      <p className="py-6 text-center text-sm text-muted-foreground">
                        No cities match &quot;{search}&quot;
                      </p>
                    ) : (
                      pageSlice.map(city => (
                        <CityCard
                          key={city.id}
                          city={city}
                          joined={false}
                          actionLabel={actionLabel}
                          actionDisabled={isInvestor && atLimit}
                          actionLoading={actionMutation.isPending && actionMutation.variables === city.id}
                          onAction={() => actionMutation.mutate(city.id)}
                        />
                      ))
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs text-muted-foreground">
                          Page {safePage} of {totalPages}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-7"
                            disabled={safePage <= 1}
                            onClick={() => setPage(p => p - 1)}
                          >
                            <ChevronLeft className="size-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="size-7"
                            disabled={safePage >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                          >
                            <ChevronRight className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
  )
}
