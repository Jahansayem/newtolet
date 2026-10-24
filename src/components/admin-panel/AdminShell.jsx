'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  FiArrowRight,
  FiLogOut,
  FiMenu,
  FiSearch,
  FiX,
} from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'

// Must match the `lg:` Tailwind breakpoint used for the persistent sidebar below.
const DESKTOP_SIDEBAR_QUERY = '(min-width: 1024px)'
const DRAWER_ID = 'admin-sidebar-drawer'

const groupItems = (items = []) => {
  const primary = items.filter((item) => !item.section)
  const sections = items.reduce((accumulator, item) => {
    if (!item.section) {
      return accumulator
    }

    if (!accumulator[item.section]) {
      accumulator[item.section] = []
    }

    accumulator[item.section].push(item)
    return accumulator
  }, {})

  return { primary, sections }
}

const SidebarLink = ({ item, activeKey, onClick }) => {
  const Icon = item.icon
  const isActive = item.key === activeKey

  return (
    <Link
      to={item.href}
      onClick={onClick}
      aria-current={isActive ? 'page' : undefined}
      className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
        isActive
          ? 'bg-brand text-white shadow-lg shadow-blue-500/20'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <span
        className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
          isActive ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-white'
        }`}
      >
        <Icon className="text-[1.15rem]" />
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  )
}

// Fills whichever flex-column <aside> contains it (persistent sidebar or drawer) and is ONE
// scroll region: logo, nav list and the Signed In card scroll together. A pinned footer was
// unreachable on iOS Safari, where the bottom toolbar covers the end of a fixed drawer.
// overscroll-contain keeps the drawer's scroll from chaining into the page on touch devices.
const SidebarContent = ({ activeKey, items, onNavigate }) => {
  const { user, handleLogout } = useAuth()
  const grouped = useMemo(() => groupItems(items), [items])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <div className="border-b border-slate-200 px-6 py-6">
        <Link to="/" onClick={onNavigate} className="flex items-center gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand text-lg font-bold text-white shadow-lg shadow-blue-500/25">
            NT
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              TailAdmin Shell
            </p>
            <h2 className="truncate text-lg font-semibold text-slate-900">Admin Control</h2>
          </div>
        </Link>
      </div>

      <div className="px-4 py-5">
        <div className="space-y-2">
          {grouped.primary.map((item) => (
            <SidebarLink
              key={item.key}
              item={item}
              activeKey={activeKey}
              onClick={onNavigate}
            />
          ))}
        </div>

        {Object.entries(grouped.sections).map(([section, sectionItems]) => (
          <div key={section} className="mt-8">
            <p className="mb-3 px-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              {section}
            </p>
            <div className="space-y-2">
              {sectionItems.map((item) => (
                <SidebarLink
                  key={item.key}
                  item={item}
                  activeKey={activeKey}
                  onClick={onNavigate}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-slate-200 p-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Signed In</p>
          <p className="mt-2 truncate text-sm font-semibold text-slate-900">{user?.name || 'Admin User'}</p>
          <p className="mt-1 truncate text-xs text-slate-500">{user?.phone || user?.email || 'No contact added'}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <FiLogOut />
            Log Out
          </button>
        </div>
      </div>
    </div>
  )
}

const AdminShell = ({
  activeKey,
  title,
  items,
  currentUserName,
  searchQuery,
  onSearchChange,
  showSearch = false,
  children,
}) => {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // While the drawer is open: close on Escape and lock page scroll behind it.
  useEffect(() => {
    if (!sidebarOpen) {
      return undefined
    }

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSidebarOpen(false)
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [sidebarOpen])

  // The drawer is hidden by CSS from `lg` up; keep React state in sync so the scroll lock
  // is released and the drawer is not left open when the viewport shrinks again.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined
    }

    const mediaQuery = window.matchMedia(DESKTOP_SIDEBAR_QUERY)
    const handleChange = (event) => {
      if (event.matches) {
        setSidebarOpen(false)
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  return (
    <div className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-[1720px]">
        {/* Persistent sidebar (lg and up): pinned to the viewport, nav list scrolls inside. */}
        <aside
          aria-label="Admin navigation"
          className="sticky top-0 hidden h-dvh w-[272px] shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white lg:flex xl:w-[308px]"
        >
          <SidebarContent activeKey={activeKey} items={items} />
        </aside>

        {/* Drawer (below lg). */}
        <div
          className={`fixed inset-0 z-50 lg:hidden ${
            sidebarOpen ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          <div
            aria-hidden="true"
            className={`absolute inset-0 bg-slate-950/45 transition-opacity duration-300 ${
              sidebarOpen ? 'opacity-100' : 'opacity-0'
            }`}
            onClick={() => setSidebarOpen(false)}
          />
          <aside
            id={DRAWER_ID}
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            inert={!sidebarOpen}
            className={`absolute inset-y-0 left-0 flex w-[308px] max-w-[88vw] flex-col overflow-hidden bg-white shadow-2xl transition-transform duration-300 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            <div className="flex shrink-0 justify-end px-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 text-slate-600"
                aria-label="Close navigation"
              >
                <FiX aria-hidden="true" />
              </button>
            </div>
            <SidebarContent
              activeKey={activeKey}
              items={items}
              onNavigate={() => setSidebarOpen(false)}
            />
          </aside>
        </div>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
            <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <div className="flex min-w-0 items-start gap-3">
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 text-slate-700 lg:hidden"
                  aria-label="Open navigation"
                  aria-expanded={sidebarOpen}
                  aria-controls={DRAWER_ID}
                >
                  <FiMenu aria-hidden="true" />
                </button>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                    NewTolet Admin
                  </p>
                  <h1 className="mt-1 text-balance break-words text-2xl font-bold tracking-tight text-slate-900 sm:text-[2rem]">
                    {title}
                  </h1>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                {showSearch ? (
                  <label className="relative block w-full sm:w-[22rem]">
                    <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => onSearchChange(event.target.value)}
                      placeholder={`Search ${title.toLowerCase()}...`}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-brand focus:bg-white"
                    />
                  </label>
                ) : null}

                <div className="hidden items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex">
                  <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#eef2ff] text-sm font-semibold text-brand">
                    {String(currentUserName || 'A').slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Operator</p>
                    <p className="truncate text-sm font-semibold text-slate-900">{currentUserName || 'Admin'}</p>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="px-4 py-6 sm:px-6 lg:px-8">
            <div className="mb-6 hidden rounded-[28px] bg-gradient-to-r from-brand via-brand to-brand px-6 py-6 text-white shadow-lg shadow-blue-500/15 md:block">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-100/80">
                    TailAdmin Migration
                  </p>
                  <h2 className="mt-2 text-xl font-semibold sm:text-2xl">
                    All admin operations now live under one navigation shell.
                  </h2>
                </div>
                <Link
                  to="/"
                  className="inline-flex items-center gap-2 self-start rounded-2xl bg-white/15 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  Return to homepage
                  <FiArrowRight />
                </Link>
              </div>
            </div>

            {children}
          </div>
        </main>
      </div>
    </div>
  )
}

export default AdminShell
