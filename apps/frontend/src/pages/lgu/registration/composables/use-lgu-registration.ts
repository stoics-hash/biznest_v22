import { useState } from 'react'
import type { FormEvent } from 'react'
import type { AxiosError } from 'axios'
import { registerLguAdminUsersLguRegisterPost } from '@networking/api/generated/users/users'
import { router } from '@/router'

function getErrorMessage(err: unknown): string {
  const axiosErr = err as AxiosError<{ detail?: string }>
  return axiosErr?.response?.data?.detail ?? 'Something went wrong. Please try again.'
}

interface UseLguRegistrationOptions {
  token: string
  email: string
}

export function useLguRegistration({ token, email }: UseLguRegistrationOptions) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (username.length < 3) {
      setError('Username must be at least 3 characters.')
      return
    }

    setLoading(true)
    try {
      await registerLguAdminUsersLguRegisterPost({ token, email, username, password })
      setSuccess(true)
      await router.navigate({ to: '/login' })
    } catch (err) {
      setError(getErrorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  return {
    username, setUsername,
    password, setPassword,
    confirmPassword, setConfirmPassword,
    error, loading, success,
    handleSubmit,
  }
}