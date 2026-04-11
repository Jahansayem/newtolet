'use client'

import { useEffect } from 'react'
import { getSiteTheme } from '../../src/services/adminService'

const SITE_THEME_STORAGE_KEY = 'siteTheme'
const SITE_THEME_EVENT = 'site-theme-updated'
const DEFAULT_SITE_THEME = 'light'

const normalizeTheme = (value) => (value === 'dark' ? 'dark' : DEFAULT_SITE_THEME)

const applyTheme = (theme) => {
  if (typeof document === 'undefined') {
    return
  }

  const normalizedTheme = normalizeTheme(theme)
  document.documentElement.dataset.theme = normalizedTheme
  document.documentElement.classList.toggle('dark', normalizedTheme === 'dark')
  document.documentElement.style.colorScheme = normalizedTheme

  try {
    localStorage.setItem(SITE_THEME_STORAGE_KEY, JSON.stringify(normalizedTheme))
  } catch (error) {
    console.error('Failed to persist site theme locally:', error)
  }
}

const readCachedTheme = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_SITE_THEME
  }

  try {
    return normalizeTheme(JSON.parse(localStorage.getItem(SITE_THEME_STORAGE_KEY) || 'null'))
  } catch {
    return DEFAULT_SITE_THEME
  }
}

const ThemeController = () => {
  useEffect(() => {
    applyTheme(readCachedTheme())

    let isMounted = true

    const syncTheme = async () => {
      const theme = await getSiteTheme()
      if (isMounted) {
        applyTheme(theme)
      }
    }

    void syncTheme()

    const handleStorage = (event) => {
      if (event.key === SITE_THEME_STORAGE_KEY) {
        applyTheme(readCachedTheme())
      }
    }

    const handleThemeUpdated = (event) => {
      applyTheme(event?.detail?.theme || readCachedTheme())
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(SITE_THEME_EVENT, handleThemeUpdated)

    return () => {
      isMounted = false
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(SITE_THEME_EVENT, handleThemeUpdated)
    }
  }, [])

  return null
}

export default ThemeController
