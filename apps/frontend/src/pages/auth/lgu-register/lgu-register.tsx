import { useSearch } from '@tanstack/react-router'
import { ShieldX } from 'lucide-react'
import { BrandIcon } from '@/config/navigation'
import { AuthImagePanel } from '@/pages/auth/register/components/auth-image-panel'
import { RegisterForm } from '@/pages/auth/register/components/register-form'
import { useLguRegisterForm } from './composables/use-lgu-register-form'

const LGU_TOKEN = import.meta.env.VITE_LGU_REGISTER_TOKEN as string | undefined

function InvalidLink() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-4 text-center max-w-sm">
        <div className="rounded-full bg-destructive/10 p-4">
          <ShieldX className="size-8 text-destructive" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight">Invalid invitation link</h1>
        <p className="text-sm text-muted-foreground">
          This LGU registration link is invalid or has expired. Contact your administrator for a valid link.
        </p>
      </div>
    </div>
  )
}

export function LguRegisterPage() {
  const { token } = useSearch({ from: '/lgu-register' })
  const form = useLguRegisterForm()

  if (!LGU_TOKEN || token !== LGU_TOKEN) {
    return <InvalidLink />
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <AuthImagePanel quote='"Manage your city data, zoning records, and hazard reports — all on BizNest."' />

      <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <div className="mb-8 flex items-center gap-2 text-sm font-semibold lg:hidden">
          <BrandIcon className="size-4" />
          BizNest
        </div>

        <div className="w-full max-w-sm">
          <div className="mb-6 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <p className="text-xs font-medium text-primary">LGU Administrator Registration</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              This account will have full city management permissions.
            </p>
          </div>
          <RegisterForm
            email={form.email}
            setEmail={form.setEmail}
            username={form.username}
            setUsername={form.setUsername}
            password={form.password}
            setPassword={form.setPassword}
            error={form.error}
            loading={form.loading}
            onSubmit={form.handleSubmit}
          />
        </div>
      </div>
    </div>
  )
}
