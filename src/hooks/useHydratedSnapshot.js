import { useEffect, useRef, useState } from 'react'
import { readSnapshot } from '../services/cacheService'

export default function useHydratedSnapshot(key) {
  const [snapshot, setSnapshot] = useState(null)
  const [hasSnapshot, setHasSnapshot] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const isMounted = useRef(true)

  useEffect(() => {
    isMounted.current = true

    return () => {
      isMounted.current = false
    }
  }, [])

  useEffect(() => {
    const cachedValue = readSnapshot(key)

    if (isMounted.current) {
      setSnapshot(cachedValue)
      setHasSnapshot(cachedValue !== null)
      setIsHydrated(true)
    }
  }, [key])

  return {
    snapshot,
    hasSnapshot,
    isHydrated,
  }
}
