import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { RxCross2 } from 'react-icons/rx'
import { listcontext } from '../Route/Listprovaider'
import CategoryFilterBar from '../Home/CategoryFilterBar'
import Cover from '../Home/Cover'
import Homelist from '../Home/Homelist'
import PropertySearchForm from '../Home/PropertySearchForm'
import { logCustomerSearch } from '../../services/searchHistoryService'
import {
  DEFAULT_SEARCH_FILTERS,
  buildSearchHref,
  clearSearchFilter,
  getActiveSearchChips,
  getSearchLocationPayload,
  getSearchRouteContext,
  getSearchPriceSummary,
  hasActiveSearchFilters,
  parseSearchFilters,
  updateSearchFilters,
} from '../Home/propertySearch'

const Propertylist2 = () => {
  const [resultCount, setResultCount] = useState(null)
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const routeParams = useParams()
  const { isLoading, selectedCategory, setSelectedCategory } = useContext(listcontext)
  const lastLoggedSignatureRef = useRef('')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const routeContext = useMemo(
    () => getSearchRouteContext(location.pathname, routeParams),
    [location.pathname, routeParams]
  )

  const searchFilters = useMemo(
    () => parseSearchFilters(searchParams, routeContext),
    [routeContext, searchParams]
  )

  const activeChips = useMemo(
    () => getActiveSearchChips(searchFilters),
    [searchFilters]
  )

  const hasActiveFilters = hasActiveSearchFilters(searchFilters)

  const searchSignature = useMemo(
    () =>
      JSON.stringify({
        filters: searchFilters,
        resultCount,
      }),
    [resultCount, searchFilters]
  )

  useEffect(() => {
    if (selectedCategory !== searchFilters.category) {
      setSelectedCategory(searchFilters.category)
    }
  }, [searchFilters.category, selectedCategory, setSelectedCategory])

  useEffect(() => {
    if (isLoading || resultCount === null || !hasActiveFilters) {
      return
    }

    if (lastLoggedSignatureRef.current === searchSignature) {
      return
    }

    lastLoggedSignatureRef.current = searchSignature

    logCustomerSearch({
      searchQuery: searchFilters.search,
      selectedLocation: getSearchLocationPayload(searchFilters),
      selectedCategory: searchFilters.category,
      selectedPriceRange: getSearchPriceSummary(searchFilters),
      filters: searchFilters,
      resultCount,
    })
  }, [hasActiveFilters, isLoading, resultCount, searchFilters, searchSignature])

  const applyNextFilters = (nextFilters) => {
    navigate(buildSearchHref(nextFilters, routeContext), { replace: true })
  }

  const handleFieldChange = (field, value) => {
    applyNextFilters(updateSearchFilters(searchFilters, field, value))
  }

  const handleCategorySelect = (category) => {
    const nextCategory = searchFilters.category === category ? 'All' : category
    applyNextFilters(updateSearchFilters(searchFilters, 'category', nextCategory))
  }

  const handleClearAll = () => {
    setSelectedCategory(DEFAULT_SEARCH_FILTERS.category)
    navigate(buildSearchHref(DEFAULT_SEARCH_FILTERS, routeContext), { replace: true })
  }

  const handleClearChip = (chipKey) => {
    applyNextFilters(clearSearchFilter(searchFilters, chipKey))
  }

  return (
    <div className='site-shell-wide min-h-screen bg-gray-50 py-6 md:py-8'>
      <div className='sticky top-[72px] z-40 -mx-4 mb-6 border-b border-gray-200/80 bg-gray-50/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5 md:top-[118px] lg:-mx-8 lg:px-8 xl:mx-0 xl:px-0'>
        <CategoryFilterBar
          selectedCategory={searchFilters.category}
          onCategorySelect={handleCategorySelect}
        />
      </div>

      <div className='mb-8 md:mb-10'>
        <Cover />
      </div>

      <div className='site-card-strong mb-8 p-4 sm:p-5 md:p-6 lg:p-7'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
          <div className='max-w-3xl'>
            <p className='site-kicker'>
              Search Rentals
            </p>
            <h1 className='mt-3 text-balance text-3xl font-bold text-gray-800 md:text-4xl lg:text-[2.65rem]'>Find properties the way tenants actually search</h1>
            <p className='mt-3 text-sm leading-7 text-gray-600 md:text-base'>
              Filter by area, budget, category, property type, and room count with shareable result URLs.
            </p>
          </div>

          <button
            type='button'
            onClick={() => setMobileFiltersOpen((current) => !current)}
            className='site-button-secondary md:hidden'
          >
            {mobileFiltersOpen ? 'Hide Filters' : 'Show Filters'}
          </button>
        </div>

        <div className={`mt-6 ${mobileFiltersOpen ? 'block' : 'hidden'} md:block`}>
          <PropertySearchForm
            filters={searchFilters}
            onFieldChange={handleFieldChange}
            onSubmit={(event) => event.preventDefault()}
            onReset={handleClearAll}
            showSort
            submitLabel='Filters Applied'
            resetLabel='Reset Search'
          />
        </div>

        {activeChips.length > 0 && (
          <div className='mt-5 flex flex-wrap items-center gap-2.5'>
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type='button'
                onClick={() => handleClearChip(chip.key)}
                className='inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800'
              >
                <span>{chip.label}</span>
                <RxCross2 className='text-base text-white/80' />
              </button>
            ))}

            <button
              type='button'
              onClick={handleClearAll}
              className='site-button-secondary text-sm'
            >
              Clear all
            </button>
          </div>
        )}
      </div>

      <Homelist
        searchFilters={searchFilters}
        onResultsChange={setResultCount}
      />
    </div>
  )
}

export default Propertylist2
