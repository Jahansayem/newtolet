'use client'

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import ReactDOM from 'react-dom'
import { RxCross2 } from 'react-icons/rx'
import { FiSearch } from 'react-icons/fi'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import {
  buildSearchHref as buildPropertySearchHref,
  getLocationOptions,
  getSearchRouteContext,
  parseSearchFilters,
  PROPERTY_TYPE_OPTIONS,
  ROOM_FILTER_OPTIONS,
  updateSearchFilters,
} from './propertySearch'
import { getRoutePage } from '../../lib/routePaths'
import { DEFAULT_SEARCH_FILTERS } from './propertySearchCore'
import { HOME_CATEGORIES } from './categoryConfig'
import { useLanguage } from '../../i18n/useLanguage'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Keeps Tab inside an open dialog (same pattern as the navigation drawer).
const trapTab = (container, event) => {
  if (event.key !== 'Tab' || !container) {
    return
  }

  const focusable = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter(
    (element) => element.offsetParent !== null
  )

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
}

export default function NavSearchOverlay({
  searchOpen,
  setSearchOpen,
  mobileSearchOpen,
  setMobileSearchOpen,
  closeMenu,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFilters, setSearchFilters] = useState({ ...DEFAULT_SEARCH_FILTERS })
  const [selectedCategory, setSelectedCategory] = useState('All')
  const navigate = useNavigate()
  const { t, tv } = useLanguage()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const wasOpenRef = useRef(false)
  const desktopPanelRef = useRef(null)
  const mobilePanelRef = useRef(null)
  const desktopKeywordRef = useRef(null)
  const previouslyFocusedRef = useRef(null)
  const idPrefix = useId()
  const desktopTitleId = `${idPrefix}-title`

  // When the overlay opens on a results page, start from the filters already in the URL so a
  // new search refines them instead of silently discarding them.
  const urlFilters = useMemo(() => {
    if (getRoutePage(location.pathname, searchParams) !== 'propertylist2') {
      return null
    }
    const divisionSlug = (location.pathname.match(/\/bd\/property-division\/([^/]+)/) || [])[1] || ''
    return parseSearchFilters(searchParams, getSearchRouteContext(location.pathname, { divisionSlug }))
  }, [location.pathname, searchParams])

  const locationOptions = useMemo(() => getLocationOptions(searchFilters), [searchFilters])

  const activeSearchFilters = useMemo(
    () => ({ ...searchFilters, search: searchQuery, category: selectedCategory }),
    [searchFilters, searchQuery, selectedCategory]
  )
  const searchHref = useMemo(
    () => buildPropertySearchHref(activeSearchFilters),
    [activeSearchFilters]
  )

  const resetSearchFilters = useCallback(() => {
    setSearchQuery('')
    setSearchFilters({ ...DEFAULT_SEARCH_FILTERS })
    setSelectedCategory('All')
  }, [])

  const isOpen = Boolean(searchOpen || mobileSearchOpen)

  useEffect(() => {
    if (isOpen && !wasOpenRef.current && urlFilters) {
      setSearchQuery(urlFilters.search || '')
      setSelectedCategory(urlFilters.category || 'All')
      setSearchFilters({ ...DEFAULT_SEARCH_FILTERS, ...urlFilters })
    }

    wasOpenRef.current = isOpen
  }, [isOpen, urlFilters])

  // Dialog focus: remember the trigger, move focus inside on open, restore on unmount/close.
  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    previouslyFocusedRef.current = document.activeElement
    const frame = requestAnimationFrame(() => {
      const desktopVisible = desktopPanelRef.current && desktopPanelRef.current.offsetParent !== null
      if (desktopVisible) {
        desktopKeywordRef.current?.focus()
      }
      // The mobile sheet's keyword input uses autoFocus.
    })

    return () => {
      cancelAnimationFrame(frame)
      const previous = previouslyFocusedRef.current
      if (previous && typeof previous.focus === 'function' && document.contains(previous)) {
        previous.focus()
      }
    }
  }, [isOpen])

  // One close path for every X / Cancel / backdrop: both overlay flags off (the tab bar opens
  // both), and the draft cleared so nothing stale is submitted next time.
  const closeOverlay = useCallback(() => {
    setSearchOpen(false)
    setMobileSearchOpen(false)
    resetSearchFilters()
  }, [resetSearchFilters, setMobileSearchOpen, setSearchOpen])

  const handleSearchSubmit = useCallback(() => {
    navigate(searchHref)
    setSearchOpen(false)
    setMobileSearchOpen(false)
    resetSearchFilters()
    closeMenu()
  }, [searchHref, navigate, setSearchOpen, setMobileSearchOpen, resetSearchFilters, closeMenu])

  const handleFieldChange = useCallback((field, value) => {
    if (field === 'search') {
      setSearchQuery(value)
    } else if (field === 'category') {
      setSelectedCategory(value)
    } else {
      setSearchFilters((current) => updateSearchFilters(current, field, value))
    }
  }, [])

  const handleCategoryClick = useCallback((category) => {
    const newCategory = selectedCategory === category ? 'All' : category
    setSelectedCategory(newCategory)
  }, [selectedCategory])

  // Stable handlers (refs are only read inside the event, never during render).
  const handleDesktopKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      closeOverlay()
      return
    }
    trapTab(desktopPanelRef.current, event)
  }, [closeOverlay])

  const handleMobileKeyDown = useCallback((event) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      closeOverlay()
      return
    }
    trapTab(mobilePanelRef.current, event)
  }, [closeOverlay])

  const isDistrictDisabled = !locationOptions.districts.length
  const isAreaDisabled = !locationOptions.upazillas.length

  // Shared field set; `prefix` keeps desktop and mobile ids unique.
  const renderFields = (prefix) => {
    const id = (name) => `${idPrefix}-${prefix}-${name}`

    return (
      <>
        <div>
          <p id={id('category-label')} className='ui-label'>{t('search.form.category')}</p>
          <div role='group' aria-labelledby={id('category-label')} className='flex flex-wrap gap-2'>
            {HOME_CATEGORIES.map((category) => (
              <button
                key={category}
                type='button'
                onClick={() => handleCategoryClick(category)}
                aria-pressed={selectedCategory === category}
                className='ui-chip min-h-9 px-3.5 py-1.5 text-sm'
              >
                {tv('categories', category)}
              </button>
            ))}
          </div>
        </div>

        <div className='grid gap-3 sm:grid-cols-2'>
          <div>
            <label htmlFor={id('division')} className='ui-label'>{t('search.form.division')}</label>
            <select
              id={id('division')}
              value={searchFilters.division}
              onChange={(e) => handleFieldChange('division', e.target.value)}
              className='ui-field'
            >
              <option value=''>{t('search.overlay.selectDivision')}</option>
              {locationOptions.divisions.map((division) => (
                <option key={division} value={division}>
                  {tv('divisions', division)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={id('district')} className='ui-label'>{t('search.form.district')}</label>
            <select
              id={id('district')}
              value={searchFilters.district}
              onChange={(e) => handleFieldChange('district', e.target.value)}
              disabled={isDistrictDisabled}
              className='ui-field'
            >
              <option value=''>
                {isDistrictDisabled ? t('search.overlay.selectDivisionFirst') : t('search.overlay.selectDistrict')}
              </option>
              {locationOptions.districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={id('area')} className='ui-label'>{t('search.overlay.areaThana')}</label>
            <select
              id={id('area')}
              value={searchFilters.upazilla}
              onChange={(e) => handleFieldChange('upazilla', e.target.value)}
              disabled={isAreaDisabled}
              className='ui-field'
            >
              <option value=''>
                {isAreaDisabled ? t('search.overlay.selectDivisionFirst') : t('search.overlay.selectArea')}
              </option>
              {locationOptions.upazillas.map((upazilla) => (
                <option key={upazilla} value={upazilla}>
                  {upazilla}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={id('propertyType')} className='ui-label'>{t('search.form.propertyType')}</label>
            <select
              id={id('propertyType')}
              value={searchFilters.propertyType}
              onChange={(e) => handleFieldChange('propertyType', e.target.value)}
              className='ui-field'
            >
              <option value='All'>{t('search.overlay.allTypes')}</option>
              {PROPERTY_TYPE_OPTIONS.map((propertyType) => (
                <option key={propertyType} value={propertyType}>
                  {tv('propertyTypes', propertyType)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={id('minRent')} className='ui-label'>{t('search.form.minRent')}</label>
            <input
              id={id('minRent')}
              type='text'
              inputMode='numeric'
              value={searchFilters.minPrice}
              onChange={(e) => handleFieldChange('minPrice', e.target.value)}
              placeholder={t('search.form.minPlaceholder')}
              className='ui-field'
            />
          </div>
          <div>
            <label htmlFor={id('maxRent')} className='ui-label'>{t('search.form.maxRent')}</label>
            <input
              id={id('maxRent')}
              type='text'
              inputMode='numeric'
              value={searchFilters.maxPrice}
              onChange={(e) => handleFieldChange('maxPrice', e.target.value)}
              placeholder={t('search.form.maxPlaceholder')}
              className='ui-field'
            />
          </div>

          <div>
            <label htmlFor={id('rooms')} className='ui-label'>{t('search.form.rooms')}</label>
            <select
              id={id('rooms')}
              value={searchFilters.rooms}
              onChange={(e) => handleFieldChange('rooms', e.target.value)}
              className='ui-field'
            >
              <option value=''>{t('search.overlay.anyRooms')}</option>
              {ROOM_FILTER_OPTIONS.map((rooms) => (
                <option key={rooms} value={rooms}>
                  {t('search.form.roomsOption', { rooms })}
                </option>
              ))}
            </select>
          </div>
        </div>
      </>
    )
  }

  // Desktop dialog (md and up)
  const renderDesktopSearch = () => {
    if (!searchOpen) return null

    return ReactDOM.createPortal(
      <div
        className='fixed inset-0 z-[10001] hidden items-center justify-center bg-ink/55 p-4 md:flex'
        onClick={closeOverlay}
      >
        <div
          ref={desktopPanelRef}
          role='dialog'
          aria-modal='true'
          aria-labelledby={desktopTitleId}
          onKeyDown={handleDesktopKeyDown}
          onClick={(event) => event.stopPropagation()}
          className='ui-panel flex max-h-[calc(100dvh-2rem)] w-full max-w-xl flex-col overflow-hidden shadow-overlay'
        >
          <div className='flex items-center justify-between border-b border-line px-5 py-4'>
            <h2 id={desktopTitleId} className='text-lg font-bold text-ink'>{t('search.overlay.title')}</h2>
            <button
              type='button'
              onClick={closeOverlay}
              className='ui-btn ui-btn-ghost ui-btn-icon text-muted'
              aria-label={t('search.overlay.close')}
            >
              <RxCross2 className='text-xl' aria-hidden='true' />
            </button>
          </div>

          <form
            onSubmit={(event) => { event.preventDefault(); handleSearchSubmit(); }}
            className='flex min-h-0 flex-1 flex-col'
          >
            <div className='min-h-0 flex-1 space-y-4 overflow-y-auto p-5'>
              <div className='relative'>
                <FiSearch className='pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted' aria-hidden='true' />
                <input
                  ref={desktopKeywordRef}
                  type='search'
                  value={searchQuery}
                  onChange={(e) => handleFieldChange('search', e.target.value)}
                  placeholder={t('search.overlay.keywordPlaceholder')}
                  aria-label={t('search.overlay.keywordLabel')}
                  className='ui-field pl-10'
                />
              </div>

              {renderFields('desktop')}
            </div>

            <div className='flex items-center justify-end gap-3 border-t border-line px-5 py-4'>
              <button type='button' onClick={closeOverlay} className='ui-btn ui-btn-secondary ui-btn-sm'>
                {t('common.cancel')}
              </button>
              <button type='submit' className='ui-btn ui-btn-primary ui-btn-sm'>
                <FiSearch className='text-base' aria-hidden='true' />
                <span>{t('common.search')}</span>
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    )
  }

  // Mobile full-screen sheet (below md)
  const renderMobileSearch = () => {
    if (!mobileSearchOpen) return null

    return ReactDOM.createPortal(
      <div className='fixed inset-0 z-[10000] md:hidden'>
        <div className='absolute inset-0 bg-ink/55' onClick={closeOverlay} aria-hidden='true' />
        <form
          id='mobile-search-form'
          ref={mobilePanelRef}
          role='dialog'
          aria-modal='true'
          aria-label={t('search.overlay.title')}
          onKeyDown={handleMobileKeyDown}
          onSubmit={(e) => { e.preventDefault(); handleSearchSubmit(); }}
          className='absolute inset-0 flex flex-col bg-white animate-fade-in-down'
        >
          <div className='flex shrink-0 items-center gap-2 border-b border-line px-3 py-2'>
            <button
              type='submit'
              className='ui-btn ui-btn-ghost ui-btn-icon shrink-0 text-muted'
              aria-label={t('search.overlay.submitAria')}
            >
              <FiSearch className='text-xl' aria-hidden='true' />
            </button>
            <input
              type='search'
              placeholder={t('search.overlay.mobileKeywordPlaceholder')}
              aria-label={t('search.overlay.keywordLabel')}
              className='min-w-0 flex-1 rounded-lg bg-transparent px-1 py-2 text-base text-ink outline-none placeholder:text-subtle focus-visible:ring-2 focus-visible:ring-brand/40'
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              autoFocus
            />
            {searchQuery ? (
              <button
                type='button'
                onClick={() => setSearchQuery('')}
                aria-label={t('search.overlay.clearKeyword')}
                className='ui-btn ui-btn-ghost ui-btn-icon shrink-0 text-muted'
              >
                <RxCross2 className='text-xl' aria-hidden='true' />
              </button>
            ) : null}
            <button
              type='button'
              onClick={closeOverlay}
              className='ui-btn ui-btn-ghost ui-btn-sm text-brand'
            >
              {t('common.cancel')}
            </button>
          </div>
          <div className='min-h-0 flex-1 space-y-4 overflow-y-auto p-4'>
            {renderFields('mobile')}
          </div>
          <div className='flex shrink-0 items-center justify-end gap-3 border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]'>
            <button type='button' onClick={closeOverlay} className='ui-btn ui-btn-secondary ui-btn-sm'>
              {t('common.cancel')}
            </button>
            <button type='submit' className='ui-btn ui-btn-primary ui-btn-sm'>
              <FiSearch className='text-base' aria-hidden='true' />
              <span>{t('common.search')}</span>
            </button>
          </div>
        </form>
      </div>,
      document.body
    )
  }

  if (!isOpen || typeof document === 'undefined') {
    return null
  }

  return (
    <>
      {renderDesktopSearch()}
      {renderMobileSearch()}
    </>
  )
}
