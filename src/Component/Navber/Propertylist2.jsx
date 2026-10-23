import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { normalizeHrefKey, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { RxCross2 } from 'react-icons/rx'
import { listcontext } from '../Route/Listprovaider'
import CategoryFilterBar from '../Home/CategoryFilterBar'
import Homelist from '../Home/Homelist'
import PropertySearchForm from '../Home/PropertySearchForm'
import { logCustomerSearch } from '../../services/searchHistoryService'
import { findPublicPropertyIdByNumber } from '../../services/propertyCatalogService'
import { buildListDetailsHref } from '../../lib/routePaths'
import { extractExactPropertyIdNumber } from '../../utils/propertyDisplaySerial'
import {
  DEFAULT_SEARCH_FILTERS,
  buildSearchHref,
  clearSearchFilter,
  getActiveSearchChips,
  getSearchChipLabel,
  getSearchLocationPayload,
  getSearchRouteContext,
  getSearchPriceSummary,
  hasActiveSearchFilters,
  parseSearchFilters,
  updateSearchFilters,
} from '../Home/propertySearch'
import { useLanguage } from '../../i18n/useLanguage'

const Propertylist2 = () => {
  const [resultCount, setResultCount] = useState(null)
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const routeParams = useParams()
  const { isLoading, selectedCategory, setSelectedCategory } = useContext(listcontext)
  const lastLoggedSignatureRef = useRef('')
  const { t, tv } = useLanguage()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const divisionSlug = Array.isArray(routeParams?.divisionSlug)
    ? routeParams.divisionSlug[0] || ''
    : routeParams?.divisionSlug || ''
  const routeContext = useMemo(
    () => getSearchRouteContext(location.pathname, { divisionSlug }),
    [divisionSlug, location.pathname]
  )
  const searchParamsString = useMemo(
    () => searchParams.toString(),
    [searchParams]
  )

  const urlSearchFilters = useMemo(
    () => parseSearchFilters(new URLSearchParams(searchParamsString), routeContext),
    [routeContext, searchParamsString]
  )
  const urlSearchSignature = useMemo(
    () => JSON.stringify(urlSearchFilters),
    [urlSearchFilters]
  )
  const [searchFilters, setSearchFilters] = useState(urlSearchFilters)

  // A new URL means a new search: forget the previous result count so the search log
  // never records the old number against the new filters.
  useEffect(() => {
    setResultCount(null)
  }, [urlSearchSignature])

  useEffect(() => {
    setSearchFilters((currentFilters) => {
      const currentSignature = JSON.stringify(currentFilters)

      return currentSignature === urlSearchSignature ? currentFilters : urlSearchFilters
    })
  }, [urlSearchFilters, urlSearchSignature])

  const committedSearchFilters = urlSearchFilters

  // An exact Property ID ("100001", "ID: 100001") opens the listing directly instead of
  // rendering a one-card results page. 'checking' holds the list back so the keyword
  // search does not fire and flicker before the redirect. A miss (pending, inactive,
  // unknown, or service down) falls through to the normal search and its empty state.
  const exactPropertyIdNumber = extractExactPropertyIdNumber(committedSearchFilters.search)
  const [exactIdLookup, setExactIdLookup] = useState(exactPropertyIdNumber ? 'checking' : 'none')

  useEffect(() => {
    if (!exactPropertyIdNumber) {
      setExactIdLookup('none')
      return undefined
    }

    let isMounted = true
    setExactIdLookup('checking')

    findPublicPropertyIdByNumber(exactPropertyIdNumber).then((propertyId) => {
      if (!isMounted) {
        return
      }

      if (propertyId) {
        // replace: Back returns to wherever the search started, not to this results URL.
        navigate(buildListDetailsHref(propertyId), { replace: true })
        return
      }

      setExactIdLookup('none')
    })

    return () => {
      isMounted = false
    }
  }, [exactPropertyIdNumber, navigate])

  const activeChips = useMemo(
    () => getActiveSearchChips(committedSearchFilters),
    [committedSearchFilters]
  )

  const hasActiveFilters = hasActiveSearchFilters(committedSearchFilters)

  const searchSignature = useMemo(
    () =>
      JSON.stringify({
        filters: committedSearchFilters,
        resultCount,
      }),
    [committedSearchFilters, resultCount]
  )

  useEffect(() => {
    if (selectedCategory !== committedSearchFilters.category) {
      setSelectedCategory(committedSearchFilters.category)
    }
  }, [committedSearchFilters.category, selectedCategory, setSelectedCategory])

  useEffect(() => {
    if (isLoading || resultCount === null || !hasActiveFilters) {
      return
    }

    if (lastLoggedSignatureRef.current === searchSignature) {
      return
    }

    lastLoggedSignatureRef.current = searchSignature

    logCustomerSearch({
      searchQuery: committedSearchFilters.search,
      selectedLocation: getSearchLocationPayload(committedSearchFilters),
      selectedCategory: committedSearchFilters.category,
      selectedPriceRange: getSearchPriceSummary(committedSearchFilters),
      filters: committedSearchFilters,
      resultCount,
    })
  }, [committedSearchFilters, hasActiveFilters, isLoading, resultCount, searchSignature])

  const applyNextFilters = useCallback((nextFilters, options = {}) => {
    setSearchFilters(nextFilters)

    if (!options.syncUrl) {
      return
    }

    const nextHref = buildSearchHref(nextFilters, routeContext)
    const nextUrl = new URL(nextHref, 'http://localhost')
    const currentUrl = new URL(location.href || '/', 'http://localhost')

    // Compare canonical forms: location.href carries the trailing slash, nextHref does not.
    if (
      normalizeHrefKey(nextUrl.pathname, nextUrl.search) !==
      normalizeHrefKey(currentUrl.pathname, currentUrl.search)
    ) {
      // Submits and category picks push so Back steps through searches; chip clears replace.
      navigate(nextHref, { replace: Boolean(options.replace) })
    }
  }, [location.href, navigate, routeContext])

  const handleFieldChange = useCallback((field, value) => {
    setSearchFilters((currentFilters) => updateSearchFilters(currentFilters, field, value))
  }, [])

  const handleCategorySelect = useCallback((category) => {
    const nextCategory = searchFilters.category === category ? 'All' : category
    applyNextFilters(updateSearchFilters(searchFilters, 'category', nextCategory), { syncUrl: true })
  }, [applyNextFilters, searchFilters])

  const handleSearchSubmit = useCallback((event) => {
    event.preventDefault()
    applyNextFilters(searchFilters, { syncUrl: true })
  }, [applyNextFilters, searchFilters])

  const handleClearAll = useCallback(() => {
    setSelectedCategory(DEFAULT_SEARCH_FILTERS.category)
    applyNextFilters(DEFAULT_SEARCH_FILTERS, { syncUrl: true, replace: true })
  }, [applyNextFilters, setSelectedCategory])

  const handleClearChip = useCallback((chipKey) => {
    applyNextFilters(clearSearchFilter(committedSearchFilters, chipKey), { syncUrl: true, replace: true })
  }, [applyNextFilters, committedSearchFilters])

  return (
    <div className='site-shell min-h-screen py-5 md:py-6'>
      <div className='site-shell-bleed sticky top-[var(--nav-h)] z-40 mb-6 border-b border-line/80 bg-canvas/95 py-2.5 backdrop-blur'>
        <CategoryFilterBar
          selectedCategory={searchFilters.category}
          onCategorySelect={handleCategorySelect}
        />
      </div>

      <div className='mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between'>
        <div className='max-w-3xl'>
          <h1 className='text-2xl font-bold leading-tight text-ink md:text-3xl'>{t('nav.propertyList')}</h1>
          <p className='mt-1 text-caption text-muted md:text-body'>
            {t('listing.browse.subtitle')}
          </p>
        </div>

        <div className='md:hidden'>
          <button
            type='button'
            onClick={() => setMobileFiltersOpen((current) => !current)}
            className='ui-btn ui-btn-secondary w-full'
            aria-expanded={mobileFiltersOpen}
            aria-controls='property-search-filters'
          >
            {mobileFiltersOpen ? t('listing.browse.hideFilters') : t('listing.browse.showFilters')}
          </button>
        </div>
      </div>

      {/* On phones the card only renders when it has something to show (open filters or active chips). */}
      <div className={`ui-card mb-6 p-4 sm:p-5 ${mobileFiltersOpen || activeChips.length > 0 ? '' : 'hidden md:block'}`}>
        <div id='property-search-filters' className={`${mobileFiltersOpen ? 'block' : 'hidden'} md:block`}>
          <PropertySearchForm
            filters={searchFilters}
            onFieldChange={handleFieldChange}
            onSubmit={handleSearchSubmit}
            onReset={handleClearAll}
            showSort
            submitLabel={t('listing.browse.submit')}
            resetLabel={t('listing.browse.reset')}
          />
        </div>

        {activeChips.length > 0 && (
          <div className='mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4' aria-label={t('listing.browse.activeFilters')}>
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type='button'
                onClick={() => handleClearChip(chip.key)}
                className='ui-chip ui-chip-selected min-h-9 py-1 pr-2 text-sm'
                aria-label={t('listing.browse.removeFilter', { filter: getSearchChipLabel(chip, t, tv) })}
              >
                <span>{getSearchChipLabel(chip, t, tv)}</span>
                <RxCross2 className='text-base opacity-80' aria-hidden='true' />
              </button>
            ))}

            <button
              type='button'
              onClick={handleClearAll}
              className='ui-btn ui-btn-ghost ui-btn-sm text-brand'
            >
              {t('listing.browse.clearAll')}
            </button>
          </div>
        )}
      </div>

      {exactIdLookup === 'checking' ? (
        <div
          className='ui-card flex items-center justify-center p-10 text-caption text-muted'
          role='status'
          aria-live='polite'
          aria-busy='true'
        >
          {t('common.loading')}
        </div>
      ) : (
        <Homelist
          searchFilters={committedSearchFilters}
          onResultsChange={setResultCount}
        />
      )}
    </div>
  )
}

export default Propertylist2
