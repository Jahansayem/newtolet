'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams as useNextSearchParams } from 'next/navigation'

const EMPTY_PARAMS = new URLSearchParams()

function SearchParamsBridge({ onChange }) {
  const searchParams = useNextSearchParams()
  const key = searchParams?.toString() || ''

  useEffect(() => {
    onChange(key)
  }, [key, onChange])

  return null
}

/**
 * Search params for layout chrome (header, footer, bottom bar) without the static-export bailout.
 *
 * Calling next/navigation's useSearchParams() during a static build makes Next render the nearest
 * Suspense fallback instead of the component, so a header that reads the query string ships as
 * an empty skeleton. Here only a tiny bridge suspends; the caller renders on the server with empty
 * params and picks up the real ones after hydration.
 *
 * Returns [params, bridgeElement]; render bridgeElement anywhere in the caller's output.
 */
export function useDeferredSearchParams() {
  const [queryString, setQueryString] = useState('')
  const params = queryString ? new URLSearchParams(queryString) : EMPTY_PARAMS
  const bridge = (
    <Suspense fallback={null}>
      <SearchParamsBridge onChange={setQueryString} />
    </Suspense>
  )
  return [params, bridge]
}
