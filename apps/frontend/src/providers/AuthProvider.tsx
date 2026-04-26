import { useReducer, useEffect, type PropsWithChildren } from 'react'
import {
  currentUserUsersMeGet,
  loginUsersLoginPost,
  logoutUsersLogoutPost,
  registerUsersRegisterPost,
} from '@networking/api/generated/users/users'
import { getUserRolesUserRolesUserIdGet, assignRoleUserRolesPost } from '@networking/api/generated/user-roles/user-roles'
import { listRolesRolesGet } from '@networking/api/generated/roles/roles'
import { myAccessCityAccessMeGet } from '@networking/api/generated/city-access/city-access'
import {
  listAssignmentsLguAssignmentsGet,
  getCityByUserLguAssignmentsUserUserIdCityGet,
} from '@networking/api/generated/lgu-assignments/lgu-assignments'
import { router } from '@/router'
import { AuthContext, type AuthAction, type AuthData, type AuthState } from '@/context/auth.context'
import type { UserResponse } from '@networking/api/model/userResponse'

// Permissions seeded per role in backend core/seed.py
const ROLE_PERMISSIONS: Record<string, string[]> = {
  investor: ['city:view', 'zoning:read', 'hazard:read', 'establishment:read', 'analytics:view', 'location:save'],
  lgu_admin: [
    'city:view',
    'zoning:read', 'zoning:write',
    'hazard:read', 'hazard:write',
    'establishment:read', 'establishment:write',
    'alert:read', 'alert:write',
    'analytics:view',
    'location:save',
  ],
}

function authReducer(_state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'RESTORE_START':
      return { state: 'RESTORING' }
    case 'AUTH_SUCCESS':
      return {
        state: 'AUTHENTICATED',
        user: action.user,
        role_name: action.role_name,
        permissions: action.permissions,
        city_ids: action.city_ids,
        lgu_city: action.lgu_city,
      }
    case 'UNAUTHENTICATED':
      return { state: 'UNAUTHENTICATED' }
    case 'SIGN_OUT':
      return { state: 'SIGNING_OUT' }
  }
}

async function resolveAuth(user: UserResponse) {
  const rolesRes = await getUserRolesUserRolesUserIdGet(user.id)
  const userRole = rolesRes.data[0] ?? null
  const role_name = userRole?.role.name ?? null
  const permissions = role_name ? (ROLE_PERMISSIONS[role_name] ?? []) : []

  let city_ids: string[] = []
  let lgu_city = undefined
  try {
    if (role_name === 'investor') {
      const accessRes = await myAccessCityAccessMeGet()
      city_ids = accessRes.data.map(a => a.city_id)
    } else if (role_name === 'lgu_admin') {
      const assignRes = await listAssignmentsLguAssignmentsGet()
      city_ids = assignRes.data.filter(a => a.user_id === user.id).map(a => a.city_id)
      const cityRes = await getCityByUserLguAssignmentsUserUserIdCityGet(user.id)
      lgu_city = cityRes.data
    }
  } catch {
    // non-critical — proceed with empty city list
  }

  return { user, role_name, permissions, city_ids, lgu_city }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(authReducer, { state: 'BOOT' } as AuthState)

  useEffect(() => {
    void restoreSession()
  }, [])

  async function restoreSession() {
    dispatch({ type: 'RESTORE_START' })
    try {
      const userRes = await currentUserUsersMeGet()
      const result = await resolveAuth(userRes.data)
      dispatch({ type: 'AUTH_SUCCESS', ...result })
    } catch {
      dispatch({ type: 'UNAUTHENTICATED' })
    }
  }

  async function signIn(username: string, password: string) {
    await loginUsersLoginPost({ username, password })
    const userRes = await currentUserUsersMeGet()
    const result = await resolveAuth(userRes.data)
    dispatch({ type: 'AUTH_SUCCESS', ...result })
    await router.navigate({ to: '/city-setup' })
  }

  async function register(email: string, username: string, password: string, role: 'investor' | 'lgu_admin' = 'investor') {
    await registerUsersRegisterPost({ email, username, password })
    const userRes = await currentUserUsersMeGet()
    const rolesRes = await listRolesRolesGet()
    const targetRole = rolesRes.data.find(r => r.name === role)
    if (targetRole) {
      await assignRoleUserRolesPost({ user_id: userRes.data.id, role_id: targetRole.id })
    }
    const result = await resolveAuth(userRes.data)
    dispatch({ type: 'AUTH_SUCCESS', ...result })
    await router.navigate({ to: '/city-setup' })
  }

  async function signOut() {
    dispatch({ type: 'SIGN_OUT' })
    try {
      await logoutUsersLogoutPost()
    } finally {
      dispatch({ type: 'UNAUTHENTICATED' })
      await router.navigate({ to: '/login' })
    }
  }

  async function refreshCities() {
    if (state.state !== 'AUTHENTICATED') return
    const result = await resolveAuth(state.user)
    dispatch({ type: 'AUTH_SUCCESS', ...result })
  }

  const value: AuthData = { state, signIn, register, signOut, refreshCities }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
