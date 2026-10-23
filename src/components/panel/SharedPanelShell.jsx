'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiLogOut, FiMenu, FiX } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'

const DEFAULT_LABELS = {
  accountUser: 'Account User',
  noPhone: 'No phone added',
  logOut: 'Log Out',
  openMenu: 'Open navigation menu',
  closeMenu: 'Close navigation menu',
  navigation: 'Dashboard navigation',
}

const groupPanelItems = (items = []) => {
  const primary = items.filter((item) => !item.section)
  const sections = items.reduce((acc, item) => {
    if (!item.section) {
      return acc
    }

    if (!acc[item.section]) {
      acc[item.section] = []
    }

    acc[item.section].push(item)
    return acc
  }, {})

  return { primary, sections }
}

const NavButton = ({ item, activeKey, onNavigate }) => {
  const Icon = item.icon
  const isActive = item.key === activeKey

  return (
    <Link
      to={item.href}
      onClick={onNavigate}
      aria-current={isActive ? 'page' : undefined}
      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
        isActive
          ? 'bg-brand text-white shadow-sm'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon className="shrink-0 text-[1.1rem]" />
      <span>{item.label}</span>
    </Link>
  )
}

const SidebarContent = ({
  activeKey,
  items,
  logoSrc,
  logoAlt,
  logoHref,
  onNavigate,
  userName,
  userPhone,
  onLogout,
  footer = null,
  labels = DEFAULT_LABELS,
}) => {
  const groups = useMemo(() => groupPanelItems(items), [items])

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200 px-6 py-5">
        {logoHref ? (
          <Link to={logoHref} onClick={onNavigate} className="inline-flex">
            <img src={logoSrc} alt={logoAlt} className="h-10 w-auto max-w-[160px] object-contain" />
          </Link>
        ) : (
          <img src={logoSrc} alt={logoAlt} className="h-10 w-auto max-w-[160px] object-contain" />
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-5">
        <div className="space-y-2">
          {groups.primary.map((item) => (
            <NavButton
              key={item.key}
              item={item}
              activeKey={activeKey}
              onNavigate={onNavigate}
            />
          ))}
        </div>

        {Object.entries(groups.sections).map(([section, sectionItems]) => (
          <div key={section} className="mt-7 space-y-2">
            <p className="px-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
              {section}
            </p>
            <div className="space-y-2">
              {sectionItems.map((item) => (
                <NavButton
                  key={item.key}
                  item={item}
                  activeKey={activeKey}
                  onNavigate={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-200 p-4">
        {footer || (
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">{userName || labels.accountUser}</p>
            <p className="mt-1 text-xs text-slate-500">{userPhone || labels.noPhone}</p>
            <button
              type="button"
              onClick={onLogout}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <FiLogOut />
              {labels.logOut}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const SharedPanelShell = ({
  activeKey,
  title,
  children,
  headerActions = null,
  items,
  getTitle,
  panelLabel,
  logoSrc = '/logo.png',
  logoAlt = 'NewTolet',
  logoHref,
  footer = null,
  labels,
  stickyTopClassName = 'top-0',
}) => {
  const { user, handleLogout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!sidebarOpen) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [sidebarOpen])

  const resolvedTitle = title || getTitle(activeKey)
  const resolvedLabels = { ...DEFAULT_LABELS, ...(labels || {}) }

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1680px]">
        <aside aria-label={resolvedLabels.navigation} className="hidden w-[320px] shrink-0 border-r border-slate-200 bg-white xl:block">
          <SidebarContent
            activeKey={activeKey}
            items={items}
            logoSrc={logoSrc}
            logoAlt={logoAlt}
            logoHref={logoHref}
            userName={user?.name}
            userPhone={user?.phone}
            onLogout={handleLogout}
            footer={footer}
            labels={resolvedLabels}
          />
        </aside>

        <div
          className={`fixed inset-0 z-50 xl:hidden ${
            sidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          <div
            className={`absolute inset-0 bg-slate-950/45 transition ${sidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'}`}
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
          <aside
            id="panel-sidebar-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={resolvedLabels.navigation}
            inert={!sidebarOpen}
            className={`absolute left-0 top-0 h-full w-[320px] max-w-[86vw] overflow-y-auto bg-white shadow-2xl transition-transform duration-300 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex justify-end p-4">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                aria-label={resolvedLabels.closeMenu}
                className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-700"
              >
                <FiX />
              </button>
            </div>
            <SidebarContent
              activeKey={activeKey}
              items={items}
              logoSrc={logoSrc}
              logoAlt={logoAlt}
              logoHref={logoHref}
              onNavigate={() => setSidebarOpen(false)}
              userName={user?.name}
              userPhone={user?.phone}
              onLogout={handleLogout}
              footer={footer}
              labels={resolvedLabels}
            />
          </aside>
        </div>

        <main className="min-w-0 flex-1">
          <header className={`sticky ${stickyTopClassName} z-40 border-b border-slate-200 bg-white/95 backdrop-blur`}>
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  aria-label={resolvedLabels.openMenu}
                  aria-expanded={sidebarOpen}
                  aria-controls="panel-sidebar-drawer"
                  className="mt-1 flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 xl:hidden"
                >
                  <FiMenu />
                </button>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                    {panelLabel}
                  </p>
                  <h1 className="text-balance text-2xl font-bold text-slate-900 sm:text-[2rem]">{resolvedTitle}</h1>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">{headerActions}</div>
            </div>
          </header>

          <div className="px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  )
}

export default SharedPanelShell
