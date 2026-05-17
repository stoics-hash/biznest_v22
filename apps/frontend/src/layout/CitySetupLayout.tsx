import { Outlet } from '@tanstack/react-router'
import { Map, LogOut } from 'lucide-react'
import { useAuthContext } from '@/context/auth.context'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function CitySetupLayout() {
  const { state, signOut } = useAuthContext()

  const user = state.state === 'AUTHENTICATED' ? state.user : null
  const userInitials = user ? (user.full_name ?? user.email).slice(0, 2).toUpperCase() : '??'

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b bg-background/95 backdrop-blur px-4 sm:px-6">
        <div className="flex items-center gap-2 font-semibold">
          <Map className="size-4 text-primary" />
          <span>BizNest</span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2 px-2">
              <div className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                {userInitials}
              </div>
              <span className="hidden sm:block text-sm max-w-[140px] truncate">
                {user?.full_name ?? user?.email}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium truncate">{user?.full_name ?? user?.email}</p>
              {user?.email && user?.full_name && (
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => void signOut()}
              className="gap-2 text-destructive focus:text-destructive"
            >
              <LogOut className="size-3.5" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <Outlet />
    </div>
  )
}