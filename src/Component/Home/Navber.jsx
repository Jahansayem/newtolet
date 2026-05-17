import React, { useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import ReactDOM from 'react-dom'
import { RxCross2 } from 'react-icons/rx'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { TfiMenu } from 'react-icons/tfi'
import { BiCoin, BiDollarCircle, BiPlus } from 'react-icons/bi'
import {
  FiBriefcase,
  FiChevronDown,
  FiChevronUp,
  FiFileText,
  FiGrid,
  FiHeart,
  FiHome,
  FiLogOut,
  FiMap,
  FiSearch,
  FiUser,
} from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import { buildDashboardHref, getRoutePage } from '../../lib/routePaths'
import { HOME_CHROME_SCROLL_EVENT } from '../../lib/homeScrollChrome'
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
const NavSearchOverlay = dynamic(() => import('./NavSearchOverlay'), {
  ssr: false,
  loading: () => null,
})

const desktopLinkClassName = (isActive) =>
  `inline-flex items-center gap-1.5 border-b-2 px-1 py-4 text-[14px] lg:text-[15px] font-medium transition ${
    isActive
      ? 'border-[#1E73B8] text-[#1E73B8]'
      : 'border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900'
  }`

const dropdownLinkClassName =
  'flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 hover:text-[#1E73B8]'

const homepageCtaClassName =
  'inline-flex h-9 items-center gap-1.5 border-y border-r border-slate-200 bg-white px-2.5 text-xs lg:text-sm lg:px-3 lg:gap-2 lg:h-10 font-semibold text-slate-700 transition first:rounded-l-lg first:border-l last:rounded-r-lg hover:border-[#1E73B8] hover:bg-[#1E73B8] hover:text-white'

const checkAdminInstant = () => {
  if (typeof window === 'undefined') return false

  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw).is_admin === true : false
  } catch {
    return false
  }
}

const DesktopNavLink = ({ href, icon, label, isActive }) => (
  <Link to={href} className={desktopLinkClassName(isActive)}>
    {React.createElement(icon, { className: 'text-[1rem]' })}
    <span>{label}</span>
  </Link>
)

const Logo = ({ className = 'h-10 w-auto max-w-[150px] object-contain md:max-w-[176px]' }) => (
  <img
    className={className}
    src={LOGO_SRC}
    alt="NewTolet.Com"
    onError={(event) => {
      event.currentTarget.src = LOGO_FALLBACK_SRC
    }}
  />
)

const Navber = () => {
  const [mounted, setMounted] = useState(false)
  const [menubtn, setmenubtn] = useState(false)
  const [isAdmin, setIsAdmin] = useState(checkAdminInstant())
  const [showProfileDropdown, setShowProfileDropdown] = useState(false)
  const [showPropertyDropdown, setShowPropertyDropdown] = useState(false)
  const [mobilePropertyDropdown, setMobilePropertyDropdown] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const { user, handleLogout: logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [routeSearchParams] = useSearchParams()
  const profileDropdownRef = useRef(null)
  const isAuthenticated = Boolean(user)
  const canUsePortal = mounted && typeof document !== 'undefined'
  const activePage = getRoutePage(location.pathname, routeSearchParams)
  const activeDashboardTab = routeSearchParams.get('tab') || 'dashboard'
  const isHomepage = location.pathname === '/'
  const [homeNavVisible, setHomeNavVisible] = useState(true)
  const propertyDropdownItems = useMemo(
    () => [
      { label: 'All property', href: buildLegacyPropertyListHref() },
      ...DIVISIONS.map((division) => ({
        label: `${division} division`,
        href: buildLegacyPropertyDivisionHref(division),
      })),
    ],
    []
  )

  useEffect(() => setMounted(true), [])
  useEffect(() => setIsAdmin(user?.is_admin === true || checkAdminInstant()), [user])

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
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setSearchOpen(false)
        setMobileSearchOpen(false)
        setShowProfileDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const handleLogout = async () => {
    await logout()
    setIsAdmin(false)
    setShowProfileDropdown(false)
    navigate('/login')
  }

  const isDesktopLinkActive = (key) => {
    switch (key) {
      case 'home':
        return location.pathname === '/'
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
  }

  return (
    <div
      className={`sticky top-0 z-50 border-b border-slate-200 bg-white/95 text-slate-900 backdrop-blur transition-transform duration-300 ${
        isHomepage && !homeNavVisible ? '-translate-y-full pointer-events-none' : 'translate-y-0'
      }`}
    >
      <div className="w-full px-3 md:px-6 xl:px-8">
        <div className="flex items-center justify-between gap-2 py-2.5 md:py-0 lg:gap-4">
          <Link to="/" className="inline-flex shrink-0 items-center py-2 md:py-3">
            <Logo className="h-10 w-auto max-w-[150px] object-contain md:h-11 md:max-w-[176px]" />
          </Link>

          <div className="hidden min-w-0 flex-1 items-center justify-between gap-3 md:flex lg:gap-6">
            <nav className="min-w-0 flex-1">
              <ul className="flex items-center gap-3 lg:gap-4 xl:gap-5">
                <li>
                  <DesktopNavLink
                    href="/"
                    icon={FiHome}
                    label="Home"
                    isActive={isDesktopLinkActive('home')}
                  />
                </li>
                <li
                  className="relative"
                  onMouseEnter={() => setShowPropertyDropdown(true)}
                  onMouseLeave={() => setShowPropertyDropdown(false)}
                >
                  <button
                    type="button"
                    onClick={() => setShowPropertyDropdown((current) => !current)}
                    className={desktopLinkClassName(isDesktopLinkActive('propertylist'))}
                  >
                    <FiMap className="text-[1rem]" />
                    <span>Property list</span>
                    {showPropertyDropdown ? (
                      <FiChevronUp className="text-xs" />
                    ) : (
                      <FiChevronDown className="text-xs" />
                    )}
                  </button>
                  <div
                    className={`absolute left-0 top-full z-40 mt-2 w-56 rounded-2xl border border-slate-200 bg-white py-2 shadow-xl transition ${showPropertyDropdown ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-2 opacity-0'}`}
                  >
                    {propertyDropdownItems.map((item) => (
                      <Link
                        key={item.href}
                        to={item.href}
                        onClick={() => setShowPropertyDropdown(false)}
                        className={dropdownLinkClassName}
                      >
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </li>
                <li>
                  <DesktopNavLink
                    href={buildDashboardHref('profile')}
                    icon={FiUser}
                    label="Profile"
                    isActive={isDesktopLinkActive('profile')}
                  />
                </li>
                <li>
                  <DesktopNavLink
                    href={buildDashboardHref('saved')}
                    icon={FiHeart}
                    label="Saved Property"
                    isActive={isDesktopLinkActive('saved')}
                  />
                </li>
                <li>
                  <DesktopNavLink
                    href="/earnmoney"
                    icon={FiGrid}
                    label="Earn Money"
                    isActive={isDesktopLinkActive('earnmoney')}
                  />
                </li>
                <li>
                  <DesktopNavLink
                    href="/article"
                    icon={FiFileText}
                    label="Article"
                    isActive={isDesktopLinkActive('article')}
                  />
                </li>
                <li>
                  <DesktopNavLink
                    href="/career"
                    icon={FiBriefcase}
                    label="Career"
                    isActive={isDesktopLinkActive('career')}
                  />
                </li>
              </ul>
            </nav>

            <div className="flex shrink-0 items-center gap-2 lg:gap-3 xl:gap-4">
              {isHomepage ? (
                <div className="hidden lg:flex items-center">
                  <Link to="/addproperty" className={homepageCtaClassName}>
                    <BiPlus className="text-base" />
                    <span>Add Property</span>
                  </Link>
                  <Link to="/my-orders" className={homepageCtaClassName}>
                    <FiHome className="text-base" />
                    <span>Order Home</span>
                  </Link>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setSearchOpen(true)}
                className={desktopLinkClassName(searchOpen)}
              >
                <FiSearch className="text-[1rem]" />
                <span>Search</span>
              </button>

              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <div className="relative" ref={profileDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowProfileDropdown((current) => !current)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:border-slate-300 hover:text-[#1E73B8]"
                      aria-label="Open account menu"
                    >
                      <FiUser className="text-lg" />
                    </button>
                    {showProfileDropdown ? (
                      <div className="absolute right-0 top-full mt-2 w-52 rounded-2xl border border-slate-200 bg-white py-2 shadow-xl">
                        <Link
                          to={buildDashboardHref('profile')}
                          onClick={() => setShowProfileDropdown(false)}
                          className={dropdownLinkClassName}
                        >
                          <FiUser className="text-base" />
                          <span>Profile</span>
                        </Link>
                        <Link
                          to="/my-properties"
                          onClick={() => setShowProfileDropdown(false)}
                          className={dropdownLinkClassName}
                        >
                          <FiMap className="text-base" />
                          <span>My Properties</span>
                        </Link>
                        <Link
                          to="/book/buy-credits"
                          onClick={() => setShowProfileDropdown(false)}
                          className={dropdownLinkClassName}
                        >
                          <BiCoin className="text-base" />
                          <span>Buy Credits</span>
                        </Link>
                        {isAdmin ? (
                          <Link
                            to="/admin"
                            onClick={() => setShowProfileDropdown(false)}
                            className={dropdownLinkClassName}
                          >
                            <FiGrid className="text-base" />
                            <span>Admin Panel</span>
                          </Link>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 text-red-500 transition hover:bg-red-50 hover:text-red-600"
                    aria-label="Log out"
                    title="Log out"
                  >
                    <FiLogOut className="text-lg" />
                  </button>
                </div>
              ) : (
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-full border border-[#1E73B8] px-4 py-2 text-sm font-semibold text-[#1E73B8] transition hover:bg-[#1E73B8] hover:text-white"
                >
                  <FiUser className="text-base" />
                  <span>Login</span>
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 md:hidden">
            <button
              type="button"
              onClick={() => setMobileSearchOpen(true)}
              className={`rounded-full p-2 transition-all duration-300 ${mobileSearchOpen ? 'bg-blue-50 text-[#1E73B8]' : 'text-zinc-700 hover:bg-gray-100'}`}
              aria-label="Open search"
            >
              <FiSearch className="text-xl" />
            </button>
            <span
              onClick={() => setmenubtn(true)}
              className="cursor-pointer p-2 text-2xl text-zinc-700 transition-colors duration-300 hover:text-[#1E73B8]"
            >
              <TfiMenu />
            </span>
          </div>
        </div>
      </div>

      {canUsePortal && menubtn
        ? ReactDOM.createPortal(
            <>
              <div
                className="fixed inset-0 bg-black/75 opacity-100 transition-opacity duration-500 md:hidden"
                style={{ zIndex: 9998 }}
                onClick={() => setmenubtn(false)}
              />
              <div
                className="fixed right-0 top-0 h-full w-[300px] border-l border-gray-200 bg-white text-gray-900 shadow-2xl md:hidden"
                style={{ zIndex: 9999 }}
              >
                <div className="h-full overflow-y-auto p-6">
                  <div className="mb-8 flex items-center justify-between border-b border-gray-200 pb-5">
                    <Link to="/" onClick={() => setmenubtn(false)} className="inline-flex items-center">
                      <Logo />
                    </Link>
                    <span
                      onClick={() => setmenubtn(false)}
                      className="cursor-pointer rounded-full p-2 text-3xl text-gray-700 transition-colors duration-300 hover:bg-gray-100"
                    >
                      <RxCross2 />
                    </span>
                  </div>
                  <ul className="flex w-full flex-col gap-2">
                    <li className="cursor-pointer rounded-lg px-4 py-3 text-lg font-medium text-gray-700 transition-all duration-300 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8]">
                      <Link to="/" className="block w-full" onClick={() => setmenubtn(false)}>
                        Home
                      </Link>
                    </li>
                    {isHomepage ? (
                      <>
                        <li className="cursor-pointer rounded-lg px-4 py-3 text-lg font-medium text-gray-700 transition-all duration-300 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8]">
                          <Link
                            to="/addproperty"
                            className="flex w-full items-center gap-3"
                            onClick={() => setmenubtn(false)}
                          >
                            <BiPlus />
                            Add Property
                          </Link>
                        </li>
                        <li className="cursor-pointer rounded-lg px-4 py-3 text-lg font-medium text-gray-700 transition-all duration-300 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8]">
                          <Link
                            to="/my-orders"
                            className="flex w-full items-center gap-3"
                            onClick={() => setmenubtn(false)}
                          >
                            <FiHome />
                            Order Home
                          </Link>
                        </li>
                      </>
                    ) : null}
                    <li className="cursor-pointer rounded-lg text-lg font-medium text-gray-700">
                      <button
                        type="button"
                        onClick={() => setMobilePropertyDropdown(!mobilePropertyDropdown)}
                        className="flex w-full items-center justify-between rounded-lg px-4 py-3 transition-all duration-300 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8]"
                      >
                        <span>Properties</span>
                        {mobilePropertyDropdown ? <FiChevronUp /> : <FiChevronDown />}
                      </button>
                      <div
                        className={`overflow-hidden transition-all duration-300 ${mobilePropertyDropdown ? 'max-h-[480px] opacity-100' : 'max-h-0 opacity-0'}`}
                      >
                    <Link
                      to={buildLegacyPropertyListHref()}
                      className="flex items-center gap-3 px-4 py-2 pl-8 text-gray-600 transition-all duration-200 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8]"
                      onClick={() => setmenubtn(false)}
                    >
                          <FiMap />
                          Property List
                        </Link>
                        <Link
                          to="/addproperty"
                          className="flex items-center gap-3 px-4 py-2 pl-8 text-gray-600 transition-all duration-200 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8]"
                          onClick={() => setmenubtn(false)}
                        >
                          <BiPlus />
                          Add Property
                        </Link>
                        {isAuthenticated ? (
                          <Link
                            to="/my-properties"
                            className="flex items-center gap-3 px-4 py-2 pl-8 text-gray-600 transition-all duration-200 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8]"
                            onClick={() => setmenubtn(false)}
                          >
                            <FiMap />
                            My Properties
                          </Link>
                        ) : null}
                      </div>
                    </li>
                    <li className="cursor-pointer rounded-lg px-4 py-3 text-lg font-medium text-gray-700 transition-all duration-300 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8]">
                      <Link
                        to={buildDashboardHref('profile')}
                        className="block w-full"
                        onClick={() => setmenubtn(false)}
                      >
                        Profile
                      </Link>
                    </li>
                    <li className="cursor-pointer rounded-lg px-4 py-3 text-lg font-medium text-gray-700 transition-all duration-300 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8]">
                      <Link
                        to={buildDashboardHref('saved')}
                        className="block w-full"
                        onClick={() => setmenubtn(false)}
                      >
                        Saved Property
                      </Link>
                    </li>
                    {isAuthenticated && !isHomepage ? (
                      <li className="cursor-pointer rounded-lg px-4 py-3 text-lg font-medium text-gray-700 transition-all duration-300 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8]">
                        <Link
                          to="/my-orders"
                          className="flex w-full items-center gap-3"
                          onClick={() => setmenubtn(false)}
                        >
                          <FiGrid />
                          Order Home
                        </Link>
                      </li>
                    ) : null}
                    <li className="cursor-pointer rounded-lg px-4 py-3 text-lg font-medium text-gray-700 transition-all duration-300 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8]">
                      <Link
                        to="/earnmoney"
                        className="flex w-full items-center gap-3"
                        onClick={() => setmenubtn(false)}
                      >
                        <BiDollarCircle />
                        Earn Money
                      </Link>
                    </li>
                    <li className="cursor-pointer rounded-lg px-4 py-3 text-lg font-medium text-gray-700 transition-all duration-300 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8]">
                      <Link to="/article" className="block w-full" onClick={() => setmenubtn(false)}>
                        Article
                      </Link>
                    </li>
                    <li className="cursor-pointer rounded-lg px-4 py-3 text-lg font-medium text-gray-700 transition-all duration-300 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8]">
                      <Link to="/career" className="block w-full" onClick={() => setmenubtn(false)}>
                        Career
                      </Link>
                    </li>
                    {isAuthenticated ? (
                      <>
                        <li className="cursor-pointer rounded-lg px-4 py-3 text-lg font-medium text-gray-700 transition-all duration-300 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8]">
                          <Link
                            to="/book/buy-credits"
                            className="flex w-full items-center gap-3"
                            onClick={() => setmenubtn(false)}
                          >
                            <BiCoin />
                            Buy Credits
                          </Link>
                        </li>
                        {isAdmin ? (
                          <li className="cursor-pointer rounded-lg px-4 py-3 text-lg font-medium text-gray-700 transition-all duration-300 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8]">
                            <Link to="/admin" className="block w-full" onClick={() => setmenubtn(false)}>
                              Admin Panel
                            </Link>
                          </li>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => {
                            handleLogout()
                            setmenubtn(false)
                          }}
                          className="mt-4 w-full rounded-lg bg-red-500 px-7 py-3 text-white transition-all duration-300 hover:bg-red-600 hover:shadow-lg"
                        >
                          Logout
                        </button>
                      </>
                    ) : (
                      <li className="mt-4">
                        <Link to="/login" className="block w-full" onClick={() => setmenubtn(false)}>
                          <button className="w-full rounded-lg bg-[#1E73B8] px-7 py-3 font-semibold text-white transition-all duration-300 hover:bg-[#1665a0] hover:shadow-lg">
                            Login
                          </button>
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
          closeMenu={() => setmenubtn(false)}
        />
      ) : null}
    </div>
  )
}

export default Navber
