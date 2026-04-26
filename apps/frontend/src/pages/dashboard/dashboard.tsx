import { Link } from '@tanstack/react-router'
import { AlertTriangle, Building2, CreditCard, MapPin, Map, ArrowRight } from 'lucide-react'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useDashboardData } from './composables/use-dashboard-data'
import { StatCard } from './components/stat-card'

export function DashboardPage() {
  const {
    user,
    role_name,
    cityIds,
    selectedCity,
    hazards,
    zoning,
    establishments,
    subscription,
    dataLoading,
  } = useDashboardData()

  const isInvestor = role_name === 'investor'
  const isLgu = role_name === 'lgu_admin'

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back, {user?.username}
        </p>
      </div>

      {/* No city selected */}
      {!selectedCity && (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed py-16 text-center">
          <MapPin className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No city selected.</p>
          <Button variant="outline" size="sm" asChild>
            <Link to="/cities">
              {isLgu ? 'Go to Cities' : 'Select a City'}
              <ArrowRight className="ml-1.5 size-3.5" />
            </Link>
          </Button>
        </div>
      )}

      {selectedCity && (
        <>
          {/* Stat cards */}
          {dataLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Loading city data…
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              <StatCard title="Hazard Areas" value={hazards.length} icon={AlertTriangle} />
              <StatCard title="Zoning Areas" value={zoning.length} icon={Map} />
              <StatCard title="Establishments" value={establishments.length} icon={Building2} />
            </div>
          )}

          {/* Subscription (investor only) */}
          {isInvestor && subscription && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">Subscription</CardTitle>
                  <CardDescription>Your current plan</CardDescription>
                </div>
                <Badge variant="secondary" className="capitalize">{subscription.plan.name}</Badge>
              </CardHeader>
              <CardContent className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5">
                  <CreditCard className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">
                    {cityIds.length} / {subscription.plan.max_cities ?? '∞'} cities used
                  </span>
                </div>
                {subscription.expires_at && (
                  <span className="text-muted-foreground ml-auto">
                    Expires {new Date(subscription.expires_at).toLocaleDateString()}
                  </span>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recent hazards */}
          {!dataLoading && hazards.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">Recent Hazards</CardTitle>
                  <CardDescription>Latest recorded hazard areas in {selectedCity.name}</CardDescription>
                </div>
              </CardHeader>
            </Card>
          )}

          {/* Recent establishments */}
          {!dataLoading && establishments.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <div>
                  <CardTitle className="text-base">Establishments</CardTitle>
                  <CardDescription>Businesses and points of interest in {selectedCity.name}</CardDescription>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/map">
                    View on Map
                    <ArrowRight className="ml-1.5 size-3.5" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {establishments.slice(0, 6).map(e => (
                    <div
                      key={e.id}
                      className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{e.name}</span>
                      {e.category && (
                        <Badge variant="outline" className="ml-auto shrink-0 text-xs capitalize">
                          {e.category}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {!dataLoading && hazards.length === 0 && zoning.length === 0 && establishments.length === 0 && (
            <>
              <Separator />
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No data recorded for {selectedCity.name} yet.
                </p>
                {isLgu && (
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/map">
                      Manage city data
                      <ArrowRight className="ml-1.5 size-3.5" />
                    </Link>
                  </Button>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
