import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import ReactDOM from 'react-dom'
import { RxCross2 } from 'react-icons/rx'
import { Link, useNavigate } from 'react-router-dom'
import { usePathname } from 'next/navigation'
import { useDeferredSearchParams } from '../../lib/useDeferredSearchParams.jsx'
import { TfiMenu } from 'react-icons/tfi'
import { BiCoin } from 'react-icons/bi'
import {
  FiChevronDown,
  FiChevronUp,
  FiGrid,
  FiHeart,
  FiHome,
  FiLogOut,
  FiMap,
  FiPlus,
  FiSearch,
  FiUser,
} from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import { useAdminPermissions } from '../../contexts/AdminAccessContext'
import { useLanguage } from '../../i18n/useLanguage'
import LanguageToggle from '../../components/LanguageToggle'
import SavedSearchBell from '../../components/listing/SavedSearchBell'
import { buildDashboardHref, getRoutePage } from '../../lib/routePaths'
import { HOME_CHROME_SCROLL_EVENT, OPEN_SEARCH_OVERLAY_EVENT } from '../../lib/homeScrollChrome'
import {
  buildLegacyPropertyDivisionHref,
  buildLegacyPropertyListHref,
} from './propertySearch'

const LOGO_SRC = '/logo.png'
const LOGO_FALLBACK_SRC = '/logo1.png'
const DIVISIONS = [
  'Dhaka',
  'Chattogram',
  'Rajshahi',
  'Khulna',
  'Barishal',
  'Sylhet',
  'Rangpur',
  'Mymensingh',
]
const NavSearchOverlay = dynamic(
  () => import('./NavSearchOverlay').then((mod) => mod.default),
  {
    ssr: false,
    loading: () => null,
  }
)

// Single-row header links: 64px row, 2px active bar on the bottom edge.
const desktopLinkClassName = (isActive) =>
  `relative inline-flex h-16 items-center gap-1.5 whitespace-nowrap px-1 text-sm font-medium transition-colors after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:transition-colors ${
    isActive
      ? 'text-brand after:bg-brand'
      : 'text-ink/80 after:bg-transparent hover:text-brand'
  }`

const dropdownLinkClassName =
  'flex items-center gap-3 px-4 py-2.5 text-sm text-ink transition hover:bg-brand-soft hover:text-brand-pressed'

const drawerLinkClassName =
  'flex w-full items-center gap-3 rounded-xl px-4 py-3 text-base font-medium text-ink transition hover:bg-brand-soft hover:text-brand-pressed'

const drawerSubLinkClassName =
  'flex items-center gap-3 rounded-xl px-4 py-2.5 pl-10 text-sm text-muted transition hover:bg-brand-soft hover:text-brand-pressed'

// Use a function that only reads from localStorage once during mount
const getInitialAdminState = () => {
  if (typeof window === 'undefined') return false

  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw).is_admin === true : false
  } catch {
    return false
  }
}

const DesktopNavLink = ({ href, label, isActive }) => (
  <Link to={href} className={desktopLinkClassName(isActive)} aria-current={isActive ? 'page' : undefined}>
    <span>{label}</span>
  </Link>
)

const Logo = ({ className = 'h-9 w-auto max-w-[150px] object-contain', alt }) => (
  <img
    className={className}
    src={LOGO_SRC}
    alt={alt}
    onError={(event) => {
      event.currentTarget.src = LOGO_FALLBACK_SRC
    }}
  />
)

const Navber = () => {
  const [mounted, setMounted] = useState(false)
  const [menubtn, setmenubtn] = useState(false)
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false)
  const [mobilePropertyDropdown, setMobilePropertyDropdown] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const { user, handleLogout: logout } = useAuth()
  const { t, tv } = useLanguage()
  const navigate = useNavigate()
  // usePathname (not the shim's useLocation, which reads search params) keeps the header in
  // the static HTML instead of bailing out to a Suspense fallback at build time.
  const pathname = usePathname() || '/'
  const [routeSearchParams, searchParamsBridge] = useDeferredSearchParams()
  const profileDropdownRef = useRef(null)
  const propertyDropdownRef = useRef(null)
  const menuButtonRef = useRef(null)
  const drawerRef = useRef(null)
  const drawerCloseRef = useRef(null)
  const drawerWasOpenRef = useRef(false)
  const isAuthenticated = Boolean(user)
  const canUsePortal = mounted && typeof document !== 'undefined'
  const activePage = getRoutePage(pathname, routeSearchParams)
  const activeDashboardTab = routeSearchParams.get('tab') || 'dashboard'
  const isHomepage = pathname === '/'
  const [homeNavVisible, setHomeNavVisible] = useState(true)
  const [hasStoredAdminRole, setHasStoredAdminRole] = useState(false)
  const isMountedRef = useRef(true)
  const isSearchOverlayOpen = searchOpen || mobileSearchOpen

  const adminAccess = useAdminPermissions()
  const isAdmin = user?.is_admin === true || hasStoredAdminRole || adminAccess.isAdmin

  const propertyDropdownItems = useMemo(
    () => [
      { label: t('nav.allProperty'), href: buildLegacyPropertyListHref() },
      ...DIVISIONS.map((division) => ({
        label: t('nav.divisionItem', { division: tv('divisions', division) }),
        href: buildLegacyPropertyDivisionHref(division),
      })),
    ],
    [t, tv]
  )

  useEffect(() => {
    isMountedRef.current = true
    setMounted(true)
    setHasStoredAdminRole(getInitialAdminState())

    return () => {
      isMountedRef.current = false
    }
  }, [])

  useEffect(() => {
    document.body.style.overflow = menubtn || mobileSearchOpen || searchOpen ? 'hidden' : 'auto'

    return () => {
      document.body.style.overflow = 'auto'
    }
  }, [menubtn, mobileSearchOpen, searchOpen])

  useEffect(() => {
    if (!isHomepage) {
      setHomeNavVisible(true)
      return undefined
    }

    const handleHomeChromeScroll = (event) => {
      setHomeNavVisible(event?.detail?.navVisible !== false)
    }

    window.addEventListener(HOME_CHROME_SCROLL_EVENT, handleHomeChromeScroll)

    return () => {
      window.removeEventListener(HOME_CHROME_SCROLL_EVENT, handleHomeChromeScroll)
    }
  }, [isHomepage])

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
        setShowProfileDropdown(false)
      }
      if (propertyDropdownRef.current && !propertyDropdownRef.current.contains(event.target)) {
        setShowPropertyDropdown(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setMobileSearchOpen(false)
        setShowProfileDropdown(false)
        setShowPropertyDropdown(false)
        setmenubtn(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  // Drawer focus management: move focus inside on open and restore it on close.
  useEffect(() => {
    if (menubtn) {
      drawerWasOpenRef.current = true
      const frame = requestAnimationFrame(() => {
        drawerCloseRef.current?.focus()
      })
      return () => cancelAnimationFrame(frame)
    }

    if (drawerWasOpenRef.current) {
      drawerWasOpenRef.current = false
      menuButtonRef.current?.focus()
    }

    return undefined
  }, [menubtn])

  const handleDrawerKeyDown = useCallback((event) => {
    if (event.key !== 'Tab' || !drawerRef.current) {
      return
    }

    const focusable = Array.from(
      drawerRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((element) => element.offsetParent !== null)

    if (focusable.length === 0) {
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }, [])

  // Both flags are set together: NavSearchOverlay renders the desktop dialog from md up and the
  // full-screen sheet below md, so whichever variant matches the viewport is the one that shows.
  const openSearch = useCallback(() => {
    setSearchOpen(true)
    setMobileSearchOpen(true)
    setShowProfileDropdown(false)
    setShowPropertyDropdown(false)
  }, [])

  // Listen for search overlay open event from the bottom tab bar
  useEffect(() => {
    window.addEventListener(OPEN_SEARCH_OVERLAY_EVENT, openSearch)

    return () => {
      window.removeEventListener(OPEN_SEARCH_OVERLAY_EVENT, openSearch)
    }
  }, [openSearch])

  const handleLogout = useCallback(async () => {
    await logout()
    setShowProfileDropdown(false)
    // Delay navigation to ensure router is ready
    if (isMountedRef.current) {
      setTimeout(() => {
        if (isMountedRef.current) {
          navigate('/login')
        }
      }, 0)
    }
  }, [logout, navigate])

  const isDesktopLinkActive = useCallback((key) => {
    switch (key) {
      case 'home':
        return pathname === '/'
      case 'propertylist':
        return activePage === 'propertylist' || activePage === 'propertylist2'
      case 'profile':
        return activePage === 'dashboard' && activeDashboardTab === 'profile'
      case 'saved':
        return activePage === 'dashboard' && activeDashboardTab === 'saved'
      case 'earnmoney':
        return activePage === 'earnmoney'
      case 'article':
        return activePage === 'article'
      case 'career':
        return activePage === 'career'
      default:
        return false
    }
  }, [pathname, activePage, activeDashboardTab])

  const closeDrawer = useCallback(() => setmenubtn(false), [])

  const accountMenuItems = [
    { href: buildDashboardHref('profile'), icon: FiUser, label: t('nav.profile') },
    { href: buildDashboardHref('saved'), icon: FiHeart, label: t('nav.savedProperty') },
    { href: '/my-properties', icon: FiMap, label: t('nav.myProperties') },
    { href: '/my-orders', icon: FiHome, label: t('nav.orderHome') },
    { href: '/book/buy-credits', icon: BiCoin, label: t('nav.buyCredits') },
    ...(isAdmin ? [{ href: '/admin', icon: FiGrid, label: t('nav.adminPanel') }] : []),
  ]

  return (
    <>
    {searchParamsBridge}
    <header
      className={`sticky top-0 z-50 border-b border-line bg-white/95 text-ink backdrop-blur transition-transform duration-300 ${
        isHomepage && !homeNavVisible ? '-translate-y-full pointer-events-none' : 'translate-y-0'
      }`}
    >
      <div className={`site-shell flex h-16 items-center gap-3 lg:gap-6 ${isHomepage ? 'site-shell-full' : ''}`}>
        <Link to="/" className="inline-flex shrink-0 items-center" aria-label={t('nav.logoAlt')}>
          <Logo alt={t('nav.logoAlt')} />
        </Link>

        <nav aria-label={t('nav.mainNavigation')} className="hidden min-w-0 flex-1 items-center lg:flex">
          <ul className="flex min-w-0 items-center gap-5 xl:gap-7">
            <li>
              <DesktopNavLink href="/" label={t('nav.home')} isActive={isDesktopLinkActive('home')} />
            </li>
            <li
              className="relative"
              ref={propertyDropdownRef}
              onMouseEnter={() => setShowPropertyDropdown(true)}
              onMouseLeave={() => setShowPropertyDropdown(false)}
            >
              <button
                type="button"
                onClick={() => setShowPropertyDropdown((current) => !current)}
                aria-expanded={showPropertyDropdown}
                aria-haspopup="true"
                className={desktopLinkClassName(isDesktopLinkActive('propertylist'))}
              >
                <span>{t('nav.propertyList')}</span>
                {showPropertyDropdown ? (
                  <FiChevronUp className="text-xs" aria-hidden="true" />
                ) : (
                  <FiChevronDown className="text-xs" aria-hidden="true" />
                )}
              </button>
              <div
                className={`absolute left-0 top-full z-40 w-56 rounded-2xl border border-line bg-white py-2 shadow-overlay transition ${showPropertyDropdown ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0'}`}
              >
                {propertyDropdownItems.map((item) => (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setShowPropertyDropdown(false)}
                    tabIndex={showPropertyDropdown ? 0 : -1}
                    className={dropdownLinkClassName}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </li>
            <li>
              <DesktopNavLink href="/earnmoney" label={t('nav.earnMoney')} isActive={isDesktopLinkActive('earnmoney')} />
            </li>
            <li>
              <DesktopNavLink href="/article" label={t('nav.article')} isActive={isDesktopLinkActive('article')} />
            </li>
            <li>
              <DesktopNavLink href="/career" label={t('nav.career')} isActive={isDesktopLinkActive('career')} />
            </li>
          </ul>
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2 lg:gap-3">
          <button
            type="button"
            onClick={openSearch}
            aria-haspopup="dialog"
            aria-expanded={isSearchOverlayOpen}
            aria-label={t('nav.openSearch')}
            className="ui-btn ui-btn-ghost ui-btn-icon lg:hidden"
          >
            <FiSearch className="text-xl" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={openSearch}
            aria-haspopup="dialog"
            aria-expanded={isSearchOverlayOpen}
            aria-label={t('nav.openSearch')}
            className="ui-btn ui-btn-ghost ui-btn-sm hidden lg:inline-flex"
          >
            <FiSearch className="text-base" aria-hidden="true" />
            <span>{t('nav.search')}</span>
          </button>

          <Link to="/addproperty" className="ui-btn ui-btn-primary ui-btn-sm hidden lg:inline-flex">
            <FiPlus className="text-base" aria-hidden="true" />
            <span>{t('nav.addProperty')}</span>
          </Link>

          <LanguageToggle size="sm" className="hidden md:inline-flex" />

          <SavedSearchBell />

          <Link
            to="/saved"
            className="hidden h-11 w-11 items-center justify-center rounded-full text-ink hover:bg-brand-soft lg:inline-flex"
            aria-label={t('nav.savedProperty')}
            title={t('nav.savedProperty')}
          >
            <FiHeart className="text-lg" aria-hidden="true" />
          </Link>

          {isAuthenticated ? (
            <div className="relative hidden lg:block" ref={profileDropdownRef}>
              <button
                type="button"
                onClick={() => setShowProfileDropdown((current) => !current)}
                className="ui-btn ui-btn-secondary ui-btn-icon"
                aria-label={t('nav.openAccountMenu')}
                aria-expanded={showProfileDropdown}
                aria-haspopup="true"
              >
                <FiUser className="text-lg" aria-hidden="true" />
              </button>
              {showProfileDropdown ? (
                <div className="absolute right-0 top-full mt-2 w-56 rounded-2xl border border-line bg-white py-2 shadow-overlay">
                  {accountMenuItems.map((item) => (
                    <Link
                      key={item.href}
                      to={item.href}
                      onClick={() => setShowProfileDropdown(false)}
                      className={dropdownLinkClassName}
                    >
                      <item.icon className="text-base" aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  ))}
                  <div className="my-2 border-t border-line" />
                  <button
                    type="button"
                    onClick={handleLogout}
                    className={`${dropdownLinkClassName} w-full text-left`}
                  >
                    <FiLogOut className="text-base" aria-hidden="true" />
                    <span>{t('nav.logout')}</span>
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Link to="/login" className="ui-btn ui-btn-secondary ui-btn-sm hidden lg:inline-flex">
              <FiUser className="text-base" aria-hidden="true" />
              <span>{t('nav.login')}</span>
            </Link>
          )}

          <button
            type="button"
            ref={menuButtonRef}
            onClick={() => setmenubtn(true)}
            aria-label={t('nav.openMenu')}
            aria-expanded={menubtn}
            aria-controls="mobile-nav-drawer"
            className="ui-btn ui-btn-ghost ui-btn-icon lg:hidden"
          >
            <TfiMenu className="text-xl" aria-hidden="true" />
          </button>
        </div>
      </div>

      {canUsePortal && menubtn
        ? ReactDOM.createPortal(
            <>
              <div
                className="fixed inset-0 z-[9998] bg-ink/70 transition-opacity duration-300 lg:hidden"
                onClick={closeDrawer}
                aria-hidden="true"
              />
              <div
                id="mobile-nav-drawer"
                ref={drawerRef}
                role="dialog"
                aria-modal="true"
                aria-label={t('nav.menuDialog')}
                onKeyDown={handleDrawerKeyDown}
                className="fixed right-0 top-0 z-[9999] h-full w-[min(320px,88vw)] border-l border-line bg-white text-ink shadow-overlay lg:hidden"
              >
                <div className="flex h-full flex-col overflow-y-auto p-5">
                  <div className="mb-5 flex items-center justify-between border-b border-line pb-4">
                    <Link to="/" onClick={closeDrawer} className="inline-flex items-center" aria-label={t('nav.logoAlt')}>
                      <Logo alt={t('nav.logoAlt')} />
                    </Link>
                    <button
                      type="button"
                      ref={drawerCloseRef}
                      onClick={closeDrawer}
                      aria-label={t('nav.closeMenu')}
                      className="ui-btn ui-btn-ghost ui-btn-icon-lg"
                    >
                      <RxCross2 className="text-2xl" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mb-4 flex items-center justify-between rounded-xl bg-canvas px-4 py-3">
                    <span className="text-sm font-medium text-muted">{t('nav.language')}</span>
                    <LanguageToggle size="sm" />
                  </div>

                  <Link to="/addproperty" onClick={closeDrawer} className="ui-btn ui-btn-primary mb-4 w-full">
                    <FiPlus className="text-base" aria-hidden="true" />
                    <span>{t('nav.addProperty')}</span>
                  </Link>

                  <ul className="flex w-full flex-col gap-1">
                    <li>
                      <Link to="/" className={drawerLinkClassName} onClick={closeDrawer}>
                        {t('nav.home')}
                      </Link>
                    </li>
                    <li>
                      <button
                        type="button"
                        onClick={() => setMobilePropertyDropdown(!mobilePropertyDropdown)}
                        aria-expanded={mobilePropertyDropdown}
                        aria-controls="mobile-nav-properties"
                        className={`${drawerLinkClassName} justify-between`}
                      >
                        <span>{t('nav.properties')}</span>
                        {mobilePropertyDropdown ? <FiChevronUp aria-hidden="true" /> : <FiChevronDown aria-hidden="true" />}
                      </button>
                      <div
                        id="mobile-nav-properties"
                        className={`overflow-hidden transition-all duration-300 ${mobilePropertyDropdown ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0'}`}
                      >
                        <Link to={buildLegacyPropertyListHref()} className={drawerSubLinkClassName} onClick={closeDrawer}>
                          <FiMap aria-hidden="true" />
                          {t('nav.propertyList')}
                        </Link>
                        {isAuthenticated ? (
                          <Link to="/my-properties" className={drawerSubLinkClassName} onClick={closeDrawer}>
                            <FiMap aria-hidden="true" />
                            {t('nav.myProperties')}
                          </Link>
                        ) : null}
                      </div>
                    </li>
                    <li>
                      <Link to="/earnmoney" className={drawerLinkClassName} onClick={closeDrawer}>
                        {t('nav.earnMoney')}
                      </Link>
                    </li>
                    <li>
                      <Link to="/article" className={drawerLinkClassName} onClick={closeDrawer}>
                        {t('nav.article')}
                      </Link>
                    </li>
                    <li>
                      <Link to="/career" className={drawerLinkClassName} onClick={closeDrawer}>
                        {t('nav.career')}
                      </Link>
                    </li>
                    <li>
                      <Link to="/my-orders" className={drawerLinkClassName} onClick={closeDrawer}>
                        {t('nav.orderHome')}
                      </Link>
                    </li>
                    {isAuthenticated ? (
                      <>
                        <li className="mt-2 border-t border-line pt-2">
                          <Link to={buildDashboardHref('profile')} className={drawerLinkClassName} onClick={closeDrawer}>
                            <FiUser aria-hidden="true" />
                            {t('nav.profile')}
                          </Link>
                        </li>
                        <li>
                          <Link to={buildDashboardHref('saved')} className={drawerLinkClassName} onClick={closeDrawer}>
                            <FiHeart aria-hidden="true" />
                            {t('nav.savedProperty')}
                          </Link>
                        </li>
                        <li>
                          <Link to="/book/buy-credits" className={drawerLinkClassName} onClick={closeDrawer}>
                            <BiCoin aria-hidden="true" />
                            {t('nav.buyCredits')}
                          </Link>
                        </li>
                        {isAdmin ? (
                          <li>
                            <Link to="/admin" className={drawerLinkClassName} onClick={closeDrawer}>
                              <FiGrid aria-hidden="true" />
                              {t('nav.adminPanel')}
                            </Link>
                          </li>
                        ) : null}
                        <li className="mt-4">
                          <button
                            type="button"
                            onClick={() => {
                              handleLogout()
                              closeDrawer()
                            }}
                            className="ui-btn ui-btn-danger-outline w-full"
                          >
                            <FiLogOut className="text-base" aria-hidden="true" />
                            <span>{t('nav.logout')}</span>
                          </button>
                        </li>
                      </>
                    ) : (
                      <li className="mt-4">
                        <Link to="/login" className="ui-btn ui-btn-secondary w-full" onClick={closeDrawer}>
                          <FiUser className="text-base" aria-hidden="true" />
                          <span>{t('nav.login')}</span>
                        </Link>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </>,
            document.body
          )
        : null}

      {searchOpen || mobileSearchOpen ? (
        <NavSearchOverlay
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
          mobileSearchOpen={mobileSearchOpen}
          setMobileSearchOpen={setMobileSearchOpen}
          closeMenu={closeDrawer}
        />
      ) : null}
    </header>
    </>
  )
}

export default Navber
