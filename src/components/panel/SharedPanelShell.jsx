'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiLogOut, FiMenu, FiSearch, FiX } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import { PanelShellContext } from './PanelShellContext'

const DEFAULT_LABELS = {
  accountUser: 'Account User',
  noPhone: 'No phone added',
  logOut: 'Log Out',
  openMenu: 'Open navigation menu',
  closeMenu: 'Close navigation menu',
  navigation: 'Dashboard navigation',
  skipToContent: 'Skip to content',
}

// Literal class strings so Tailwind v4 can scan them.
const BREAKPOINTS = {
  lg: {
    aside: 'hidden lg:flex',
    drawer: 'lg:hidden',
    header: 'lg:flex-row lg:items-center lg:justify-between lg:px-8',
    menuButton: 'lg:hidden',
    query: '(min-width: 1024px)',
  },
  xl: {
    aside: 'hidden xl:flex',
    drawer: 'xl:hidden',
    header: 'xl:flex-row xl:items-center xl:justify-between xl:px-8',
    menuButton: 'xl:hidden',
    query: '(min-width: 1280px)',
  },
}

const DRAWER_ID = 'panel-sidebar-drawer'
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const groupPanelItems = (items = [], sectionOrder = null) => {
  const primary = items.filter((item) => !item.section)
  const sections = items.reduce((acc, item) => {
    if (!item.section) return acc
    if (!acc[item.section]) acc[item.section] = []
    acc[item.section].push(item)
    return acc
  }, {})
  let entries = Object.entries(sections)
  if (Array.isArray(sectionOrder) && sectionOrder.length) {
    const rank = (name) => {
      const index = sectionOrder.indexOf(name)
      return index === -1 ? sectionOrder.length : index
    }
    entries = entries.sort(([a], [b]) => rank(a) - rank(b))
  }
  return { primary, sections: entries }
}

const NavButton = ({ item, activeKey, onNavigate }) => {
  const Icon = item.icon
  const isActive = item.key === activeKey
  const showBadge = typeof item.badge === 'number' && item.badge > 0

  return (
    <Link
      to={item.href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={`flex min-h-11 items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
        isActive ? 'bg-brand text-white shadow-sm' : 'text-muted hover:bg-brand-soft hover:text-ink'
      }`}
    >
      {Icon ? <Icon className="shrink-0 text-[1.1rem]" aria-hidden="true" /> : null}
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {showBadge ? (
        <span
          className={`ui-badge ml-auto tabular-nums ${isActive ? 'bg-white/20 text-white' : 'ui-badge-warning'}`}
          aria-label={item.badgeLabel || `${item.badge} pending`}
        >
          {item.badge > 99 ? '99+' : item.badge}
        </span>
      ) : null}
    </Link>
  )
}

const BrandImage = ({ src, fallbackSrc, alt }) => {
  const [currentSrc, setCurrentSrc] = useState(src)
  useEffect(() => setCurrentSrc(src), [src])
  return (
    <img
      src={currentSrc}
      alt={alt}
      className="h-10 w-auto max-w-[160px] object-contain"
      onError={() => {
        if (fallbackSrc && currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc)
      }}
    />
  )
}

// One scroll region: brand, nav and the account card scroll together, so the
// Log Out button is always reachable (a pinned footer was hidden behind the
// iOS Safari toolbar).
const SidebarContent = ({
  activeKey,
  items,
  sectionOrder,
  brand,
  onNavigate,
  userName,
  userDetail,
  roleLabel,
  onLogout,
  footer = null,
  labels = DEFAULT_LABELS,
}) => {
  const groups = useMemo(() => groupPanelItems(items, sectionOrder), [items, sectionOrder])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="border-b border-line px-6 py-5">{brand}</div>

      <nav className="px-4 py-5" aria-label={labels.navigation}>
        <div className="space-y-1.5">
          {groups.primary.map((item) => (
            <NavButton key={item.key} item={item} activeKey={activeKey} onNavigate={onNavigate} />
          ))}
        </div>

        {groups.sections.map(([section, sectionItems]) => (
          <div key={section} className="mt-6 space-y-1.5">
            <p className="px-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-subtle">{section}</p>
            <div className="space-y-1.5">
              {sectionItems.map((item) => (
                <NavButton key={item.key} item={item} activeKey={activeKey} onNavigate={onNavigate} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-line p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        {footer || (
          <div className="rounded-[var(--radius-card)] border border-line bg-canvas p-4">
            <p className="truncate text-sm font-semibold text-ink">{userName || labels.accountUser}</p>
            <p className="mt-1 truncate text-xs text-muted">{userDetail || labels.noPhone}</p>
            {roleLabel ? <p className="mt-2 text-xs font-medium text-brand">{roleLabel}</p> : null}
            <button
              type="button"
              onClick={onLogout}
              className="ui-btn ui-btn-sm mt-4 w-full bg-ink text-white hover:bg-ink/90"
            >
              <FiLogOut aria-hidden="true" />
              {labels.logOut}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Shared dashboard shell for the user panel and the admin panel.
 *
 * Props (all optional unless noted):
 *   activeKey, items (required), title, description, children, headerActions,
 *   getTitle, panelLabel, logoSrc/logoAlt/logoHref/logoFallbackSrc or `brand`,
 *   footer, labels, stickyTopClassName ('top-0' | 'top-[var(--nav-h)]'),
 *   sidebarBreakpoint ('xl' | 'lg'), userMeta {name, detail, roleLabel},
 *   search {value, onChange, label, placeholder}, sectionOrder, mainId, contentClassName
 */
const SharedPanelShell = ({
  activeKey,
  title,
  description = null,
  children,
  headerActions = null,
  items,
  getTitle,
  panelLabel,
  logoSrc = '/logo.png',
  logoAlt = 'NewTolet',
  logoHref,
  logoFallbackSrc = '/logo1.png',
  brand = null,
  footer = null,
  labels,
  stickyTopClassName = 'top-0',
  sidebarBreakpoint = 'xl',
  userMeta = null,
  search = null,
  sectionOrder = null,
  mainId = 'panel-main',
  contentClassName = 'px-4 py-6 sm:px-6 lg:px-8',
}) => {
  const { user, handleLogout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [contextHeader, setContextHeader] = useState(null)
  const menuButtonRef = useRef(null)
  const drawerRef = useRef(null)
  const drawerCloseRef = useRef(null)
  const wasOpenRef = useRef(false)

  const bp = BREAKPOINTS[sidebarBreakpoint] || BREAKPOINTS.xl
  const resolvedLabels = { ...DEFAULT_LABELS, ...(labels || {}) }
  const resolvedTitle = title || (getTitle ? getTitle(activeKey) : '')
  const resolvedDescription = contextHeader?.description ?? description
  const resolvedActions = contextHeader?.actions ?? headerActions
  const asideTopClassName = stickyTopClassName === 'top-0' ? 'top-0 h-dvh' : 'top-[var(--nav-h)] h-[calc(100dvh-var(--nav-h))]'

  const shellContextValue = useMemo(() => ({ setHeader: setContextHeader }), [])

  // Escape + body scroll lock while the drawer is open.
  useEffect(() => {
    if (!sidebarOpen) return undefined
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSidebarOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [sidebarOpen])

  // Keep React state in sync with the CSS breakpoint.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined
    const mediaQuery = window.matchMedia(bp.query)
    const handleChange = (event) => {
      if (event.matches) setSidebarOpen(false)
    }
    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [bp.query])

  // Focus management: close button on open, menu button on close.
  useEffect(() => {
    if (sidebarOpen) {
      wasOpenRef.current = true
      const frame = requestAnimationFrame(() => drawerCloseRef.current?.focus())
      return () => cancelAnimationFrame(frame)
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false
      menuButtonRef.current?.focus()
    }
    return undefined
  }, [sidebarOpen])

  const handleDrawerKeyDown = useCallback((event) => {
    if (event.key !== 'Tab' || !drawerRef.current) return
    const focusable = Array.from(drawerRef.current.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) => element.offsetParent !== null)
    if (focusable.length === 0) {
      event.preventDefault()
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

  const brandNode = brand || (
    logoHref ? (
      <Link to={logoHref} onClick={() => setSidebarOpen(false)} className="inline-flex">
        <BrandImage src={logoSrc} fallbackSrc={logoFallbackSrc} alt={logoAlt} />
      </Link>
    ) : (
      <BrandImage src={logoSrc} fallbackSrc={logoFallbackSrc} alt={logoAlt} />
    )
  )

  const userName = userMeta?.name || user?.name
  const userDetail = userMeta?.detail || user?.phone || user?.email
  const roleLabel = userMeta?.roleLabel || null

  const sidebarProps = {
    activeKey,
    items,
    sectionOrder,
    brand: brandNode,
    userName,
    userDetail,
    roleLabel,
    onLogout: handleLogout,
    footer,
    labels: resolvedLabels,
  }

  return (
    <PanelShellContext.Provider value={shellContextValue}>
      <div className="min-h-screen bg-canvas text-ink">
        <a href={`#${mainId}`} className="skip-link">
          {resolvedLabels.skipToContent}
        </a>
        <div className="mx-auto flex min-h-screen max-w-[1720px]">
          <aside
            aria-label={resolvedLabels.navigation}
            className={`sticky ${asideTopClassName} w-[272px] shrink-0 flex-col overflow-hidden border-r border-line bg-surface xl:w-[300px] ${bp.aside}`}
          >
            <SidebarContent {...sidebarProps} />
          </aside>

          <div className={`fixed inset-0 z-[var(--z-nav)] ${bp.drawer} ${sidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}>
            <div
              aria-hidden="true"
              className={`absolute inset-0 bg-ink/45 transition-opacity duration-300 ${sidebarOpen ? 'opacity-100' : 'opacity-0'}`}
              onClick={() => setSidebarOpen(false)}
            />
            <aside
              ref={drawerRef}
              id={DRAWER_ID}
              role="dialog"
              aria-modal="true"
              aria-label={resolvedLabels.navigation}
              inert={!sidebarOpen}
              onKeyDown={handleDrawerKeyDown}
              className={`absolute inset-y-0 left-0 flex w-[300px] max-w-[88vw] flex-col overflow-hidden bg-surface shadow-overlay transition-transform duration-300 ${
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
            >
              <div className="flex shrink-0 justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))]">
                <button
                  ref={drawerCloseRef}
                  type="button"
                  onClick={() => setSidebarOpen(false)}
                  aria-label={resolvedLabels.closeMenu}
                  className="ui-btn ui-btn-secondary ui-btn-icon"
                >
                  <FiX aria-hidden="true" />
                </button>
              </div>
              <SidebarContent {...sidebarProps} onNavigate={() => setSidebarOpen(false)} />
            </aside>
          </div>

          <main id={mainId} tabIndex={-1} className="min-w-0 flex-1 outline-none">
            <header className={`sticky ${stickyTopClassName} z-40 border-b border-line bg-surface/95 backdrop-blur`}>
              <div className={`flex flex-col gap-4 px-4 py-4 sm:px-6 ${bp.header}`}>
                <div className="flex min-w-0 items-start gap-3">
                  <button
                    ref={menuButtonRef}
                    type="button"
                    onClick={() => setSidebarOpen(true)}
                    aria-label={resolvedLabels.openMenu}
                    aria-expanded={sidebarOpen}
                    aria-controls={DRAWER_ID}
                    className={`ui-btn ui-btn-secondary ui-btn-icon mt-0.5 shrink-0 ${bp.menuButton}`}
                  >
                    <FiMenu aria-hidden="true" />
                  </button>
                  <div className="min-w-0">
                    {panelLabel ? <p className="ui-eyebrow">{panelLabel}</p> : null}
                    <h1 className="text-balance break-words text-2xl font-bold tracking-tight text-ink sm:text-[2rem]">{resolvedTitle}</h1>
                    {resolvedDescription ? <p className="mt-1 text-sm text-muted">{resolvedDescription}</p> : null}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                  {search ? (
                    <label className="relative block w-full sm:w-[20rem]">
                      <span className="sr-only">{search.label || 'Search'}</span>
                      <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-subtle" aria-hidden="true" />
                      <input
                        type="search"
                        value={search.value || ''}
                        onChange={(event) => search.onChange?.(event.target.value)}
                        placeholder={search.placeholder || 'Search…'}
                        className="ui-field pl-11"
                      />
                    </label>
                  ) : null}
                  {resolvedActions ? <div className="flex flex-wrap items-center gap-2 [&>*]:w-full sm:[&>*]:w-auto">{resolvedActions}</div> : null}
                  {userName ? (
                    <div className="hidden items-center gap-3 rounded-[var(--radius-card)] border border-line bg-canvas px-4 py-2.5 sm:flex">
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand" aria-hidden="true">
                        {String(userName).slice(0, 1).toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{userName}</p>
                        {roleLabel ? <p className="truncate text-xs text-muted">{roleLabel}</p> : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </header>

            <div className={contentClassName}>{children}</div>
          </main>
        </div>
      </div>
    </PanelShellContext.Provider>
  )
}

export default SharedPanelShell
