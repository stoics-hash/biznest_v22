import { RouterProvider } from '@tanstack/react-router'
import { useAuthContext } from '@/context/auth.context'
import { router } from '@/router'
import { queryClient } from '@/lib/query-client'
import { Spinner } from '@/components/ui/spinner'

export function RouteWithContext() {
  const auth = useAuthContext()

  if (auth.state.state === 'BOOT' || auth.state.state === 'RESTORING') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner className="size-10" />
      </div>
    )
  }

  return <RouterProvider router={router} context={{ auth, queryClient }} />
}