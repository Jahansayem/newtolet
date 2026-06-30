'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { BiBuildings, BiCoin } from 'react-icons/bi'
import { CgMenuGridO } from 'react-icons/cg'
import { FiHeart, FiHome, FiMessageSquare, FiPhone, FiPlus } from 'react-icons/fi'
import { Link } from '../../src/lib/react-router-dom.jsx'
import { buildPageHref, getRoutePage } from '../../src/lib/routePaths.js'

const PHONE_NUMBER = '+8801707346634'
const SAVED_PROPERTIES_EVENT = 'saved-properties-updated'

const menuItems = [
  {
    href: buildPageHref('addproperty'),
    label: 'Add Property',
    icon: FiPlus,
  },
  {
    href: buildPageHref('my-orders'),
    label: 'Order Home',
    icon: FiHome,
  },
  {
    href: buildPageHref('propertylist2'),
    label: 'Property List',
    icon: BiBuildings,
  },
  {
    href: buildPageHref('book-buy-credits'),
    label: 'Buy Credits',
    icon: BiCoin,
  },
  {
    href: buildPageHref('contact'),
    label: 'Contact',
    icon: FiMessageSquare,
  },
]

const getSavedPropertiesCount = () => {
  if (typeof window === 'undefined') {
    return 0
  }

  try {
    const saved = JSON.parse(localStorage.getItem('savedProperties') || '[]')
    return Array.isArray(saved) ? saved.length : 0
  } catch (error) {
    console.error('Failed to read saved properties for quick rail:', error)
    return 0
  }
}

const FloatingQuickRail = () => {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const routeKey = `${pathname}?${searchParams?.toString() || ''}`
  const page = getRoutePage(pathname, searchParams)
  const [menuOpen, setMenuOpen] = useState(false)
  const [savedCount, setSavedCount] = useState(0)
  const desktopRailRef = useRef(null)
  const mobileRailRef = useRef(null)
  const isMountedRef = useRef(true)
  const lastRouteKeyRef = useRef('')

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  // Only refresh saved count when routeKey actually changes
  useEffect(() => {
    // Skip on first render or if route hasn't changed
    if (lastRouteKeyRef.current === routeKey) {
      return
    }
    lastRouteKeyRef.current = routeKey

    if (isMountedRef.current) {
      setSavedCount(getSavedPropertiesCount())
    }
  }, [routeKey])

  useEffect(() => {
    const handleStorage = (event) => {
      if (!event.key || event.key === 'savedProperties') {
        if (isMountedRef.current) {
          setSavedCount(getSavedPropertiesCount())
        }
      }
    }

    const handleSavedPropertiesChange = () => {
      if (isMountedRef.current) {
        setSavedCount(getSavedPropertiesCount())
      }
    }

    const handleWindowFocus = () => {
      if (isMountedRef.current) {
        setSavedCount(getSavedPropertiesCount())
      }
    }

    window.addEventListener('storage', handleStorage)
    window.addEventListener(SAVED_PROPERTIES_EVENT, handleSavedPropertiesChange)
    window.addEventListener('focus', handleWindowFocus)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener(SAVED_PROPERTIES_EVENT, handleSavedPropertiesChange)
      window.removeEventListener('focus', handleWindowFocus)
    }
  }, [])

  useEffect(() => {
    if (isMountedRef.current) {
      setMenuOpen(false)
    }
  }, [routeKey])

  useEffect(() => {
    const handlePointerDown = (event) => {
      const clickInsideDesktop = desktopRailRef.current?.contains(event.target)
      const clickInsideMobile = mobileRailRef.current?.contains(event.target)

      if (!clickInsideDesktop && !clickInsideMobile && isMountedRef.current) {
        setMenuOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape' && isMountedRef.current) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('touchstart', handlePointerDown)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('touchstart', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const quickActions = useMemo(
    () => [
      // {
      //   key: 'home',
      //   href: buildPageHref(),
      //   label: 'Home',
      //   icon: FiHome,
      //   isActive: !page,
      // },
      ...(!page
        ? [
            {
              key: 'add-property',
              href: buildPageHref('addproperty'),
              label: 'Add Property',
              icon: FiPlus,
              isActive: false,
            },
            {
              key: 'order-home',
              href: buildPageHref('my-orders'),
              label: 'Order Home',
              icon: FiHome,
              isActive: false,
            },
          ]
        : []),
      {
        key: 'properties',
        href: buildPageHref('propertylist2'),
        label: 'Property List',
        icon: BiBuildings,
        isActive: ['propertylist', 'propertylist2', 'listdetails'].includes(page),
      },
      {
        key: 'saved',
        href: buildPageHref('dashboard'),
        label: 'Saved Properties',
        icon: FiHeart,
        isActive: page === 'dashboard',
        badge: savedCount > 99 ? '99+' : savedCount > 0 ? String(savedCount) : null,
      },
      {
        key: 'call',
        href: `tel:${PHONE_NUMBER}`,
        label: 'Call',
        icon: FiPhone,
        isActive: false,
        external: true,
      },
    ],
    [page, savedCount]
  )

  const railButtonClass = (active) =>
    `relative flex h-11 w-11 items-center justify-center rounded-full border text-base shadow-md transition-all duration-200 md:h-12 md:w-12 ${
      active
        ? 'border-[#1E73B8] bg-blue-50 text-[#1E73B8] shadow-lg'
        : 'border-[#1E73B8]/45 bg-white/98 text-[#1E73B8] hover:-translate-y-0.5 hover:shadow-lg'
    }`

  return (
    <>
      <div
        ref={desktopRailRef}
        className="fixed bottom-6 right-3 z-40 hidden flex-col gap-3 sm:flex md:right-4 lg:right-6"
      >
        <button
          type="button"
          aria-label="Open quick actions"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((current) => !current)}
          className={railButtonClass(menuOpen)}
        >
          <CgMenuGridO />
        </button>

        {quickActions.map((action) =>
          action.external ? (
            <a
              key={action.key}
              href={action.href}
              aria-label={action.label}
              className={railButtonClass(action.isActive)}
            >
              <action.icon />
              {action.badge ? (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#1E73B8] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {action.badge}
                </span>
              ) : null}
            </a>
          ) : (
            <Link
              key={action.key}
              href={action.href}
              aria-label={action.label}
              className={railButtonClass(action.isActive)}
            >
              <action.icon />
              {action.badge ? (
                <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#1E73B8] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {action.badge}
                </span>
              ) : null}
            </Link>
          )
        )}

        {menuOpen ? (
          <div className="absolute bottom-0 right-full mr-3 w-52 rounded-2xl border border-blue-100 bg-white p-3 shadow-2xl">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.24em] text-gray-400">
              Quick Access
            </p>
            <div className="space-y-1">
              {menuItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-blue-50 hover:text-[#1E73B8]"
                >
                  <item.icon className="text-base text-[#1E73B8]" />
                  <span>{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-40 px-3 sm:hidden">
        <div ref={mobileRailRef} className="pointer-events-auto flex justify-end">
          {menuOpen ? (
            <>
              <button
                type="button"
                aria-label="Close quick actions"
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-40 bg-black/25"
              />
              <div className="fixed inset-x-3 bottom-20 z-50 rounded-3xl border border-blue-100 bg-white p-4 shadow-2xl">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-800">Quick Access</p>
                  <button
                    type="button"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-full bg-gray-100 px-3 py-1 text-xs font-bold text-gray-600"
                  >
                    Close
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {menuItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-3 rounded-2xl border border-gray-100 px-3 py-3 text-sm font-medium text-gray-700 transition-colors duration-200 hover:bg-blue-50 hover:text-[#1E73B8]"
                    >
                      <item.icon className="text-base text-[#1E73B8]" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </>
          ) : null}

          <div className="flex max-w-[calc(100vw-1.5rem)] items-center gap-2 overflow-x-auto rounded-full border border-blue-100 bg-white/95 px-2.5 py-2 shadow-xl backdrop-blur scrollbar-hide">
            <button
              type="button"
              aria-label="Open quick actions"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((current) => !current)}
              className={railButtonClass(menuOpen)}
            >
              <CgMenuGridO />
            </button>

            {quickActions.map((action) =>
              action.external ? (
                <a
                  key={action.key}
                  href={action.href}
                  aria-label={action.label}
                  className={railButtonClass(action.isActive)}
                >
                  <action.icon />
                  {action.badge ? (
                    <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#1E73B8] px-1.5 py-0.5 text-[10px] font-semibold text-white">
                      {action.badge}
                    </span>
                  ) : null}
                </a>
              ) : (
                <Link
                  key={action.key}
                  href={action.href}
                  aria-label={action.label}
                  className={railButtonClass(action.isActive)}
                >
                  <action.icon />
                  {action.badge ? (
                    <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#1E73B8] px-1.5 py-0.5 text-[20px] font-bold text-white">
                      {action.badge}
                    </span>
                  ) : null}
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </>
  )
}

export default FloatingQuickRail
