import { Link } from '@tanstack/react-router'
import { MapPin, Map, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center justify-between border-b px-6">
        <div className="flex items-center gap-2">
          <MapPin className="size-5 text-primary" />
          <span className="font-semibold">BizNest</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
          <Button size="sm" asChild>
            <Link to="/register">Get started</Link>
          </Button>
        </div>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">
            Geo-intelligence for smarter investment
          </h1>
          <p className="mx-auto max-w-md text-muted-foreground">
            Access city-scoped hazard zones, land use data, and business establishments.
            Built for investors and local government units.
          </p>
        </div>

        <div className="flex gap-3">
          <Button asChild>
            <Link to="/register">Start for free</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/login">Sign in</Link>
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-6 text-sm">
          {[
            { icon: Map, label: 'City-scoped data', desc: 'Hazards, zoning, establishments per city' },
            { icon: BarChart3, label: 'Investment analytics', desc: 'Data-driven city comparison' },
            { icon: MapPin, label: 'LGU management', desc: 'Manage your city data directly' },
          ].map(({ icon: Icon, label, desc }) => (
            <div key={label} className="flex flex-col items-center gap-2 rounded-lg border p-4">
              <Icon className="size-6 text-muted-foreground" />
              <p className="font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
