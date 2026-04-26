import { Link } from '@tanstack/react-router'
import { BrandIcon } from '@/config/navigation'
import { useRegisterForm } from './composables/use-register-form'
import { AuthImagePanel } from './components/auth-image-panel'
import { RegisterForm } from './components/register-form'

export function RegisterPage() {
  const form = useRegisterForm()

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <AuthImagePanel quote='"Join investors and LGU administrators on BizNest — the Philippines geo-intelligence platform."' />

      <div className="flex flex-col items-center justify-center px-6 py-12 sm:px-12">
        <Link
          to={'/' as never}
          className="mb-8 flex items-center gap-2 text-sm font-semibold lg:hidden"
        >
          <BrandIcon className="size-4" />
          BizNest
        </Link>

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
  )
}
