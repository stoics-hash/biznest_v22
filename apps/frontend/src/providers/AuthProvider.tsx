import { useReducer, useEffect, useRef, type PropsWithChildren } from 'react'
import axios from 'axios'
import { tokenManager } from '@/lib/axios'
import { getUserRolesUserRolesUserIdGet } from '@networking/api/generated/user-roles/user-roles'
import { myAccessCityAccessMeGet } from '@networking/api/generated/city-access/city-access'
import {
  listAssignmentsLguAssignmentsGet,
  getCityByUserLguAssignmentsUserUserIdCityGet,
} from '@networking/api/generated/lgu-assignments/lgu-assignments'
import { router } from '@/router'
import { AuthContext, type AuthAction, type AuthData, type AuthState } from '@/context/auth.context'
import type { UserResponse } from '@networking/api/model/userResponse'
import type { CityResponse } from '@networking/api/model/cityResponse'

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

// Paths that should not trigger the 401 → refresh interceptor
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/users/lgu/register']

const CITY_ID_KEY = 'biznest:city_id'

// Refresh this many ms before the access token actually expires
const PROACTIVE_REFRESH_LEAD_MS = 60_000

interface AuthApiResponse {
  access_token: string
  id: string
  email: string
  full_name: string
  expires_in: number
}

interface CitySelectApiResponse {
  access_token: string
  city_id: string
}

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
        city_id: action.city_id,
      }
    case 'SET_CITY':
      if (_state.state !== 'AUTHENTICATED') return _state
      return { ..._state, city_id: action.city_id }
    case 'UNAUTHENTICATED':
      return { state: 'UNAUTHENTICATED' }
    case 'SIGN_OUT':
      return { state: 'SIGNING_OUT' }
  }
}

function getTokenExpiry(token: string): number | null {
  try {
    // Base64url → base64 → JSON
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(atob(b64)) as { exp?: number }
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

async function resolveAuth(user: UserResponse) {
  const rolesRes = await getUserRolesUserRolesUserIdGet(user.id)
  const userRole = rolesRes.data[0] ?? null
  const role_name = userRole?.role.name ?? null
  const permissions = role_name ? (ROLE_PERMISSIONS[role_name] ?? []) : []

  let city_ids: string[] = []
  let lgu_city: CityResponse | undefined
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

  const isRefreshingRef   = useRef(false)
  const refreshQueueRef   = useRef<QueueItem[]>([])
  const refreshTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Ref so the interceptor (set up once in useEffect) always calls the latest version
  const scheduleRefreshRef = useRef<((token: string) => void) | null>(null)

  // ── Proactive refresh helpers ─────────────────────────────────────────────

  function clearRefreshTimer() {
    if (refreshTimerRef.current !== null) {
      clearTimeout(refreshTimerRef.current)
      refreshTimerRef.current = null
    }
  }

  async function doProactiveRefresh() {
    try {
      const res = await axios.post<AuthApiResponse>('/auth/refresh')
      tokenManager.set(res.data.access_token)
      scheduleRefreshRef.current?.(res.data.access_token)
    } catch {
      // Refresh token expired or revoked — force sign-out
      clearRefreshTimer()
      tokenManager.clear()
      sessionStorage.removeItem(CITY_ID_KEY)
      dispatch({ type: 'UNAUTHENTICATED' })
      void router.navigate({ to: '/login' })
    }
  }

  function scheduleTokenRefresh(accessToken: string) {
    clearRefreshTimer()
    const exp = getTokenExpiry(accessToken)
    if (exp === null) return
    const delay = exp * 1000 - Date.now() - PROACTIVE_REFRESH_LEAD_MS
    if (delay <= 0) {
      void doProactiveRefresh()
      return
    }
    refreshTimerRef.current = setTimeout(() => void doProactiveRefresh(), delay)
  }

  // Keep ref pointing at latest version so interceptor can use it
  scheduleRefreshRef.current = scheduleTokenRefresh

  // ── 401 interceptor + session restore ─────────────────────────────────────

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
          const refreshRes = await axios.post<AuthApiResponse>('/auth/refresh')
          tokenManager.set(refreshRes.data.access_token)
          // Reschedule proactive refresh with the rotated token
          scheduleRefreshRef.current?.(refreshRes.data.access_token)
          refreshQueueRef.current.forEach(q => q.resolve(undefined))
          refreshQueueRef.current = []
          return axios(originalRequest)
        } catch (refreshError) {
          refreshQueueRef.current.forEach(q => q.reject(refreshError))
          refreshQueueRef.current = []
          clearRefreshTimer()
          tokenManager.clear()
          sessionStorage.removeItem(CITY_ID_KEY)
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
      clearRefreshTimer()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Auth actions ──────────────────────────────────────────────────────────

  async function restoreSession() {
    dispatch({ type: 'RESTORE_START' })
    try {
      // If access token expired the 401 interceptor refreshes it transparently
      const userRes = await axios.get<UserResponse>('/auth/me')
      const result = await resolveAuth(userRes.data)

      let city_id: string | undefined

      if (result.role_name === 'investor') {
        const savedCityId = sessionStorage.getItem(CITY_ID_KEY)
        if (savedCityId && result.city_ids.includes(savedCityId)) {
          try {
            const selectRes = await axios.post<CitySelectApiResponse>(`/city-access/select/${savedCityId}`)
            tokenManager.set(selectRes.data.access_token)
            city_id = savedCityId
          } catch {
            sessionStorage.removeItem(CITY_ID_KEY)
          }
        }
      } else if (result.role_name === 'lgu_admin' && result.lgu_city) {
        city_id = result.lgu_city.id
        sessionStorage.setItem(CITY_ID_KEY, city_id)
      }

      dispatch({ type: 'AUTH_SUCCESS', ...result, city_id })

      // Schedule proactive refresh — covers both fresh tokens and post-interceptor-refresh tokens
      const currentToken = tokenManager.get()
      if (currentToken) scheduleTokenRefresh(currentToken)
    } catch {
      clearRefreshTimer()
      tokenManager.clear()
      sessionStorage.removeItem(CITY_ID_KEY)
      dispatch({ type: 'UNAUTHENTICATED' })
    }
  }

  async function signIn(email: string, password: string) {
    const loginRes = await axios.post<AuthApiResponse>('/auth/login', { email, password })
    tokenManager.set(loginRes.data.access_token)
    scheduleTokenRefresh(loginRes.data.access_token)
    const userRes = await axios.get<UserResponse>('/auth/me')
    const result = await resolveAuth(userRes.data)
    sessionStorage.removeItem(CITY_ID_KEY)
    dispatch({ type: 'AUTH_SUCCESS', ...result })
    await router.navigate({ to: '/city-setup' })
  }

  async function register(
    email: string,
    full_name: string,
    password: string,
    role: 'investor' | 'lgu_admin' = 'investor',
  ) {
    const registerRes = await axios.post<AuthApiResponse>('/auth/register', { email, full_name, password, role_name: role })
    tokenManager.set(registerRes.data.access_token)
    scheduleTokenRefresh(registerRes.data.access_token)
    const userRes = await axios.get<UserResponse>('/auth/me')
    const result = await resolveAuth(userRes.data)
    sessionStorage.removeItem(CITY_ID_KEY)
    dispatch({ type: 'AUTH_SUCCESS', ...result })
    await router.navigate({ to: '/city-setup' })
  }

  async function signOut() {
    dispatch({ type: 'SIGN_OUT' })
    clearRefreshTimer()
    try {
      await axios.post('/auth/logout')
    } finally {
      tokenManager.clear()
      sessionStorage.removeItem(CITY_ID_KEY)
      dispatch({ type: 'UNAUTHENTICATED' })
      await router.navigate({ to: '/login' })
    }
  }

  async function refreshCities() {
    if (state.state !== 'AUTHENTICATED') return
    const result = await resolveAuth(state.user)
    let city_id = state.city_id
    if (result.role_name === 'lgu_admin' && result.lgu_city) {
      city_id = result.lgu_city.id
      sessionStorage.setItem(CITY_ID_KEY, city_id)
    }
    dispatch({ type: 'AUTH_SUCCESS', ...result, city_id })
  }

  async function selectCity(cityId: string) {
    if (state.state !== 'AUTHENTICATED') return

    if (state.role_name === 'investor') {
      const res = await axios.post<CitySelectApiResponse>(`/city-access/select/${cityId}`)
      tokenManager.set(res.data.access_token)
      scheduleTokenRefresh(res.data.access_token)
    }

    sessionStorage.setItem(CITY_ID_KEY, cityId)
    dispatch({ type: 'SET_CITY', city_id: cityId })
  }

  const value: AuthData = { state, signIn, register, signOut, refreshCities, selectCity }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}