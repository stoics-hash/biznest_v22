import type { PropsWithChildren } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { BrandIcon } from '@/config/navigation'

export function GuestLayout({ children }: PropsWithChildren) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link
            to={'/' as never}
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <BrandIcon className="size-4" />
            Networking
          </Link>

          <nav className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to={'/login' as never}>Sign in</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to={'/register' as never}>Get started</Link>
            </Button>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
