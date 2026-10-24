'use client'

import { useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

/** Reads/writes a deep-link query param (default `id`) used to open detail dialogs. */
export const useEntityParam = (name = 'id') => {
  const [searchParams, setSearchParams] = useSearchParams()
  const value = searchParams.get(name)
  const setValue = useCallback(
    (next) => {
      const params = new URLSearchParams(searchParams.toString())
      if (next === null || next === undefined || next === '') params.delete(name)
      else params.set(name, String(next))
      setSearchParams(params, { replace: true })
    },
    [name, searchParams, setSearchParams]
  )
  return [value, setValue]
}

export default useEntityParam
