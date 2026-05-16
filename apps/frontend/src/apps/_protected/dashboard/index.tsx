import { createFileRoute, redirect } from '@tanstack/react-router'
import { DashboardPage } from '@/pages/dashboard/dashboard'

export const Route = createFileRoute('/_protected/dashboard/')({
  beforeLoad: ({ context }) => {
    const { state } = context.auth
    if (state.state === 'AUTHENTICATED' && !state.city_id) {
      throw redirect({ to: '/city-setup', replace: true })
    }
  },
  component: DashboardPage,
})
