import { createFileRoute, redirect } from '@tanstack/react-router'
import { verifyLguInvitationUsersLguVerifyInvitationGet } from '@networking/api/generated/users/users'
import { listCitiesCitiesGet } from '@networking/api/generated/cities/cities'
import { LguRegistrationPage } from '@/pages/lgu/registration/registration'

export const Route = createFileRoute('/lgu/register')({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === 'string' ? search.token : '',
    email: typeof search.email === 'string' ? search.email : '',
    city_id: typeof search.city_id === 'string' ? search.city_id : undefined,
  }),
  beforeLoad: async ({ search }) => {
    if (!search.token || !search.email) {
      throw redirect({ to: '/login', replace: true })
    }
    let valid = false
    try {
      const res = await verifyLguInvitationUsersLguVerifyInvitationGet({
        token: search.token,
        email: search.email,
      })
      valid = res.data.valid
    } catch {
      valid = false
    }
    if (!valid) throw redirect({ to: '/login', replace: true })
  },
  loaderDeps: ({ search }) => ({ city_id: search.city_id }),
  loader: async ({ deps: { city_id } }) => {
    if (!city_id) return { city: null }
    try {
      const res = await listCitiesCitiesGet()
      return { city: res.data.find(c => c.id === city_id) ?? null }
    } catch {
      return { city: null }
    }
  },
  component: LguRegistrationPage,
})