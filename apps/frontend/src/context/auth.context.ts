import { createContext, useContext } from 'react'
import type { UserResponse } from '@networking/api/model/userResponse'

export type AuthAction =
  | { type: 'RESTORE_START' }
  | {
      type: 'AUTH_SUCCESS'
      user: UserResponse
      role_name: string | null
      permissions: string[]
      city_ids: string[]
    }
  | { type: 'UNAUTHENTICATED' }
  | { type: 'SIGN_OUT' }

export type AuthState =
  | { state: 'BOOT' }
  | { state: 'RESTORING' }
  | {
      state: 'AUTHENTICATED'
      user: UserResponse
      role_name: string | null
      permissions: string[]
      city_ids: string[]
    }
  | { state: 'UNAUTHENTICATED' }
  | { state: 'SIGNING_OUT' }

export interface AuthData {
  state: AuthState
  signIn: (username: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string, role?: 'investor' | 'lgu_admin') => Promise<void>
  signOut: () => Promise<void>
  refreshCities: () => Promise<void>
}

export const AuthContext = createContext<AuthData>({
  state: { state: 'BOOT' },
  signIn: async () => {},
  register: async () => {},
  signOut: async () => {},
  refreshCities: async () => {},
})

export const useAuthContext = () => useContext(AuthContext)
