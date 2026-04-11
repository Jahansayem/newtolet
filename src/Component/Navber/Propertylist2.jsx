import React, { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { RxCross2 } from 'react-icons/rx'
import { listcontext } from '../Route/Listprovaider'
import CategoryFilterBar from '../Home/CategoryFilterBar'
import Cover from '../Home/Cover'
import Homelist from '../Home/Homelist'
import PropertySearchForm from '../Home/PropertySearchForm'
import { logCustomerSearch } from '../../services/searchHistoryService'
import {
  DEFAULT_SEARCH_FILTERS,
  buildSearchParams,
  clearSearchFilter,
  getActiveSearchChips,
  getSearchLocationPayload,
  getSearchPriceSummary,
  hasActiveSearchFilters,
  parseSearchFilters,
  updateSearchFilters,
} from '../Home/propertySearch'

const Propertylist2 = () => {
  const [resultCount, setResultCount] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const { isLoading, selectedCategory, setSelectedCategory } = useContext(listcontext)
  const lastLoggedSignatureRef = useRef('')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  const searchFilters = useMemo(
    () => parseSearchFilters(searchParams),
    [searchParams]
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
    const nextSearchParams = buildSearchParams(nextFilters)
    setSearchParams(nextSearchParams)
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
    setSearchParams(new URLSearchParams())
  }

  const handleClearChip = (chipKey) => {
    applyNextFilters(clearSearchFilter(searchFilters, chipKey))
  }

  return (
    <div className='min-h-screen max-w-[1520px] bg-gray-50 mx-auto py-8 px-3 md:px-20 lg:px-32'>
      <div className='sticky top-[72px] z-40 -mx-3 mb-6 border-b border-gray-200/80 bg-gray-50/95 px-3 py-3 backdrop-blur md:top-[118px] md:-mx-20 md:px-20 lg:-mx-32 lg:px-32'>
        <CategoryFilterBar
          selectedCategory={searchFilters.category}
          onCategorySelect={handleCategorySelect}
        />
      </div>

      <div className='mb-8'>
        <Cover />
      </div>

      <div className='mb-8 rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm md:p-6'>
        <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
          <div>
            <p className='text-xs font-semibold uppercase tracking-[0.35em] text-[#1E73B8]'>
              Search Rentals
            </p>
            <h1 className='mt-3 text-3xl font-bold text-gray-800'>Find properties the way tenants actually search</h1>
            <p className='mt-2 text-gray-600'>
              Filter by area, budget, category, property type, and room count with shareable result URLs.
            </p>
          </div>

          <button
            type='button'
            onClick={() => setMobileFiltersOpen((current) => !current)}
            className='inline-flex items-center justify-center rounded-full border border-gray-200 bg-gray-100 px-5 py-3 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-200 md:hidden'
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
          <div className='mt-5 flex flex-wrap items-center gap-2'>
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
              className='inline-flex items-center rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50'
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
