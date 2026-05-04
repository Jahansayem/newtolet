'use client'

import React, { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiLogOut, FiMenu, FiX } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'

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
      className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
        isActive
          ? 'bg-[#1E73B8] text-white shadow-sm'
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
            <p className="text-sm font-semibold text-slate-900">{userName || 'Account User'}</p>
            <p className="mt-1 text-xs text-slate-500">{userPhone || 'No phone added'}</p>
            <button
              type="button"
              onClick={onLogout}
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <FiLogOut />
              Log Out
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
}) => {
  const { user, handleLogout } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const resolvedTitle = title || getTitle(activeKey)

  return (
    <div className="min-h-screen bg-slate-100">
      <div className="mx-auto flex min-h-screen max-w-[1680px]">
        <aside className="hidden w-[320px] shrink-0 border-r border-slate-200 bg-white xl:block">
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
          />
          <aside
            className={`absolute left-0 top-0 h-full w-[320px] max-w-[86vw] bg-white shadow-2xl transition-transform duration-300 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex justify-end p-4">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="rounded-full bg-slate-100 p-2 text-slate-700"
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
            />
          </aside>
        </div>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:px-8 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="mt-1 rounded-xl border border-slate-200 p-2 text-slate-700 xl:hidden"
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
