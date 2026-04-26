import { createFileRoute, redirect } from '@tanstack/react-router'
import { HomePage } from '@/pages/home/home'

export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    if (context.auth.state.state === 'AUTHENTICATED') {
      throw redirect({ to: '/dashboard', replace: true })
    }
  },
  component: HomePage,
})