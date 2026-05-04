import { useReducer, useEffect, useRef, type PropsWithChildren } from 'react'
import axios from 'axios'
import { tokenManager } from '@/lib/axios'
import {
  currentUserUsersMeGet,
  loginUsersLoginPost,
  logoutUsersLogoutPost,
  registerUsersRegisterPost,
  refreshUsersRefreshPost,
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

const AUTH_PATHS = ['/users/login', '/users/register', '/users/refresh', '/users/lgu/register']

type QueueItem = { resolve: (value: unknown) => void; reject: (err: unknown) => void }

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

  // refresh_token stored in memory only — never in React state or localStorage
  const refreshTokenRef = useRef<string | null>(null)
  const isRefreshingRef = useRef(false)
  const refreshQueueRef = useRef<QueueItem[]>([])

  useEffect(() => {
    const interceptorId = axios.interceptors.response.use(
      (res) => res,
      async (error) => {
        const originalRequest = error.config
        const isAuthPath = AUTH_PATHS.some(p => (originalRequest?.url as string | undefined)?.includes(p))

        if (error.response?.status !== 401 || isAuthPath || originalRequest?._retry) {
          return Promise.reject(error)
        }

        if (isRefreshingRef.current) {
          return new Promise((resolve, reject) => {
            refreshQueueRef.current.push({
              resolve: () => resolve(axios(originalRequest)),
              reject,
            })
          })
        }

        originalRequest._retry = true
        isRefreshingRef.current = true

        try {
          const refreshRes = await refreshUsersRefreshPost({
            refresh_token: refreshTokenRef.current ?? undefined,
          })
          tokenManager.set(refreshRes.data.access_token)
          refreshTokenRef.current = refreshRes.data.refresh_token
          refreshQueueRef.current.forEach(q => q.resolve(undefined))
          refreshQueueRef.current = []
          return axios(originalRequest)
        } catch (refreshError) {
          refreshQueueRef.current.forEach(q => q.reject(refreshError))
          refreshQueueRef.current = []
          refreshTokenRef.current = null
          tokenManager.clear()
          dispatch({ type: 'UNAUTHENTICATED' })
          void router.navigate({ to: '/login' })
          return Promise.reject(refreshError)
        } finally {
          isRefreshingRef.current = false
        }
      }
    )

    void restoreSession()

    return () => {
      axios.interceptors.response.eject(interceptorId)
    }
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
    const loginRes = await loginUsersLoginPost({ username, password })
    tokenManager.set(loginRes.data.access_token)
    refreshTokenRef.current = loginRes.data.refresh_token
    const userRes = await currentUserUsersMeGet()
    const result = await resolveAuth(userRes.data)
    dispatch({ type: 'AUTH_SUCCESS', ...result })
    await router.navigate({ to: '/city-setup' })
  }

  async function register(email: string, username: string, password: string, role: 'investor' | 'lgu_admin' = 'investor') {
    const registerRes = await registerUsersRegisterPost({ email, username, password })
    tokenManager.set(registerRes.data.access_token)
    refreshTokenRef.current = registerRes.data.refresh_token
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
      await logoutUsersLogoutPost({ refresh_token: refreshTokenRef.current ?? undefined })
    } finally {
      tokenManager.clear()
      refreshTokenRef.current = null
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