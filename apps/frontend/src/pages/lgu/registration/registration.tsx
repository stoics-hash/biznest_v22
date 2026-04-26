import { useSearch, useLoaderData } from '@tanstack/react-router'
import { BrandIcon } from '@/config/navigation'
import { AuthImagePanel } from '@/pages/auth/register/components/auth-image-panel'
import type { CityResponse } from '@networking/api/model/cityResponse'
import { CityAssignmentCard } from './components/city-assignment-card'
import { LguRegistrationForm } from './components/registration-form'
import { useLguRegistration } from './composables/use-lgu-registration'

export function LguRegistrationPage() {
  const { token, email } = useSearch({ from: '/lgu/register' })
  const { city } = useLoaderData({ from: '/lgu/register' }) as { city: CityResponse | null }

  const form = useLguRegistration({ token, email })

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <AuthImagePanel quote='"Manage your city data, zoning records, and hazard reports — all on BizNest."' />

      <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div className="mb-8 flex items-center gap-2 text-sm font-semibold lg:hidden">
          <BrandIcon className="size-4" />
          BizNest
        </div>

        <div className="w-full max-w-sm space-y-4">
          <CityAssignmentCard city={city} />

          <LguRegistrationForm
            email={email}
            username={form.username}
            setUsername={form.setUsername}
            password={form.password}
            setPassword={form.setPassword}
            confirmPassword={form.confirmPassword}
            setConfirmPassword={form.setConfirmPassword}
            error={form.error}
            loading={form.loading}
            onSubmit={form.handleSubmit}
          />
        </div>
      </div>
    </div>
  )
}