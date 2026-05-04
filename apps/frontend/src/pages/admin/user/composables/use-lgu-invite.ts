import { useState } from 'react'
import type { FormEvent } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import type { AxiosError } from 'axios'
import { listCitiesCitiesGet } from '@networking/api/generated/cities/cities'
import { inviteLguAdminUsersLguInvitePost } from '@networking/api/generated/users/users'
import type { LguInviteResponse } from '@networking/api/model'

function getErrorMessage(err: unknown): string {
  const axiosErr = err as AxiosError<{ detail?: string }>
  return axiosErr?.response?.data?.detail ?? 'Something went wrong. Please try again.'
}

export function useLguInvite() {
  const [email, setEmail] = useState('')
  const [cityId, setCityId] = useState<string | null>(null)
  const [result, setResult] = useState<LguInviteResponse | null>(null)

  const { data: cities = [], isLoading: citiesLoading } = useQuery({
    queryKey: ['/cities/'],
    queryFn: () => listCitiesCitiesGet().then(r => r.data),
  })

  const { mutateAsync: sendInvite, isPending: sending, error: mutationError, reset: resetMutation } = useMutation({
    mutationFn: ({ email, city_id }: { email: string; city_id: string }) =>
      inviteLguAdminUsersLguInvitePost({ email, city_id }).then(r => r.data),
    onSuccess: (data) => setResult(data),
  })

  const error = mutationError ? getErrorMessage(mutationError) : null

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!cityId) return
    await sendInvite({ email, city_id: cityId })
  }

  function reset() {
    setEmail('')
    setCityId(null)
    setResult(null)
    resetMutation()
  }

  return {
    email, setEmail,
    cityId, setCityId,
    cities, citiesLoading,
    sending,
    error,
    success: !!result,
    result,
    handleSubmit,
    reset,
  }
}