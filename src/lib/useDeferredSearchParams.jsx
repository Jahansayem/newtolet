'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
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
 * Returns [params, bridgeElement, ready]; render bridgeElement anywhere in the caller's output.
 * `ready` turns true once the real query string has been read (never on the server), so data
 * loaders can wait instead of fetching unfiltered results first.
 */
export function useDeferredSearchParams() {
  const [queryString, setQueryString] = useState(null)
  const params = useMemo(() => (queryString ? new URLSearchParams(queryString) : EMPTY_PARAMS), [queryString])
  const bridge = (
    <Suspense fallback={null}>
      <SearchParamsBridge onChange={setQueryString} />
    </Suspense>
  )
  return [params, bridge, queryString !== null]
}
