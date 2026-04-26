import { CheckCircle2, MapPin, Infinity } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { SubscriptionPlanResponse } from '@networking/api/model'

interface PlanCardProps {
  plan: SubscriptionPlanResponse
  isCurrent: boolean
}

export function PlanCard({ plan, isCurrent }: PlanCardProps) {
  return (
    <Card className={isCurrent ? 'ring-2 ring-primary' : ''}>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-lg capitalize">{plan.name}</CardTitle>
          {isCurrent && (
            <Badge className="gap-1 shrink-0">
              <CheckCircle2 className="size-3" />
              Current
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {plan.max_cities === null ? (
            <Infinity className="size-4 shrink-0" />
          ) : (
            <MapPin className="size-4 shrink-0" />
          )}
          <span>
            {plan.max_cities === null
              ? 'Unlimited cities'
              : `Up to ${plan.max_cities} ${plan.max_cities === 1 ? 'city' : 'cities'}`}
          </span>
        </div>

        <Button
          className="w-full"
          variant={isCurrent ? 'outline' : 'default'}
          disabled={isCurrent}
        >
          {isCurrent ? 'Current Plan' : 'Select Plan'}
        </Button>
      </CardContent>
    </Card>
  )
}