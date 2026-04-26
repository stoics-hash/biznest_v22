import { useAuthContext } from '@/context/auth.context'

export function usePermission(permission: string): boolean {
  const { state } = useAuthContext()
  if (state.state !== 'AUTHENTICATED') return false
  return state.permissions.includes(permission)
}

export function useRole(): string | null {
  const { state } = useAuthContext()
  if (state.state !== 'AUTHENTICATED') return null
  return state.role_name
}

export function useCityIds(): string[] {
  const { state } = useAuthContext()
  if (state.state !== 'AUTHENTICATED') return []
  return state.city_ids
}
