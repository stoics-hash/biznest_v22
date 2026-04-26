import { createFileRoute, redirect } from '@tanstack/react-router'
import { LguRegisterPage } from '@/pages/auth/lgu-register/lgu-register'

export const Route = createFileRoute('/lgu-register')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
  }),
  beforeLoad: ({ context }) => {
    if (context.auth.state.state === 'AUTHENTICATED') {
      throw redirect({ to: '/city-setup', replace: true })
    }
  },
  component: LguRegisterPage,
})
