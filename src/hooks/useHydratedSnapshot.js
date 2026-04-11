import { useEffect, useState } from 'react'
import { readSnapshot } from '../services/cacheService'

export default function useHydratedSnapshot(key) {
  const [snapshot, setSnapshot] = useState(null)
  const [hasSnapshot, setHasSnapshot] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    const cachedValue = readSnapshot(key)

    setSnapshot(cachedValue)
    setHasSnapshot(cachedValue !== null)
    setIsHydrated(true)
  }, [key])

  return {
    snapshot,
    hasSnapshot,
    isHydrated,
  }
}
