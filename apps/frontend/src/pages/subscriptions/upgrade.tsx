import { Spinner } from '@/components/ui/spinner'
import { PlanCard } from './components/plan-card'
import { useUpgrade } from './composables/use-upgrade'

export function UpgradePage() {
  const { plans, subscription, loading } = useUpgrade()

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        Loading plans…
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upgrade Plan</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a subscription plan that fits your needs
        </p>
      </div>

      {plans.length === 0 ? (
        <p className="text-sm text-muted-foreground">No plans available.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.map(plan => (
            <PlanCard
              key={plan.id}
              plan={plan}
              isCurrent={subscription?.plan_id === plan.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}