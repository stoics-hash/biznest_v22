import { createFileRoute, redirect } from '@tanstack/react-router'
import { AppShell } from '@/components/app-shell'

export const Route = createFileRoute('/_protected')({
  beforeLoad: ({ context }) => {
    if (!context.auth || context.auth.state?.state !== 'AUTHENTICATED') {
      throw redirect({ to: '/login', replace: true })
    }
  },
  component: AppShell,
})

