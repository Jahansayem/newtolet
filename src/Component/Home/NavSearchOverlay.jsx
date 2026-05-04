'use client'

import React, { useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom'
import { RxCross2 } from 'react-icons/rx'
import { FiSearch } from 'react-icons/fi'
import { Link, useNavigate } from 'react-router-dom'
import { buildListDetailsHref } from '../../lib/routePaths'
import { getSearchableProperties } from '../../services/propertyCatalogService'
import { PropertyThumbnailImage } from '../../components/PropertyCardMedia'
import PropertySearchForm from './PropertySearchForm'
import {
  buildSearchHref as buildPropertySearchHref,
  updateSearchFilters,
} from './propertySearch'
import { DEFAULT_SEARCH_FILTERS, matchesKeywordSearch } from './propertySearchCore'
import RentDisplay from '../../components/RentDisplay'

export default function NavSearchOverlay({
  searchOpen,
  setSearchOpen,
  mobileSearchOpen,
  setMobileSearchOpen,
  closeMenu,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFilters, setSearchFilters] = useState({ ...DEFAULT_SEARCH_FILTERS })
  const [searchProperties, setSearchProperties] = useState([])
  const [searchLoaded, setSearchLoaded] = useState(false)
  const [searchLoading, setSearchLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if ((!searchOpen && !mobileSearchOpen) || searchLoaded || searchLoading) {
      return
    }

    let isMounted = true

    const loadSearchData = async () => {
      setSearchLoading(true)

      try {
        const properties = await getSearchableProperties()

        if (isMounted) {
          setSearchProperties(properties)
          setSearchLoaded(true)
        }
      } catch (error) {
        console.error('Error loading navbar search data:', error)
      } finally {
        if (isMounted) {
          setSearchLoading(false)
        }
      }
    }

    void loadSearchData()

    return () => {
      isMounted = false
    }
  }, [mobileSearchOpen, searchLoaded, searchLoading, searchOpen])

  const activeSearchFilters = useMemo(
    () => ({ ...searchFilters, search: searchQuery }),
    [searchFilters, searchQuery]
  )
  const searchHref = useMemo(
    () => buildPropertySearchHref(activeSearchFilters),
    [activeSearchFilters]
  )

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) {
      return []
    }

    return searchProperties.filter((item) => matchesKeywordSearch(item, searchQuery)).slice(0, 5)
  }, [searchProperties, searchQuery])

  const resetSearchFilters = () => {
    setSearchQuery('')
    setSearchFilters({ ...DEFAULT_SEARCH_FILTERS })
  }

  const handleSearchSubmit = (event) => {
    event.preventDefault()
    navigate(searchHref)
    setSearchOpen(false)
    setMobileSearchOpen(false)
    resetSearchFilters()
    closeMenu()
  }

  const handleSearchFilterChange = (field, value) => {
    setSearchFilters((current) => updateSearchFilters(current, field, value))
  }

  const handleResultClick = () => {
    closeMenu()
    setSearchOpen(false)
    setMobileSearchOpen(false)
    resetSearchFilters()
  }

  if ((!searchOpen && !mobileSearchOpen) || typeof document === 'undefined') {
    return null
  }

  return (
    <>
      {searchOpen
        ? ReactDOM.createPortal(
            <div className="fixed inset-0 z-[10001] hidden md:block">
              <div
                className="absolute inset-0 bg-slate-950/55"
                onClick={() => setSearchOpen(false)}
              />
              <div className="absolute inset-x-0 top-24 mx-auto w-[min(960px,calc(100vw-48px))] rounded-[28px] border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                      Search
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900">
                      Find Your Next Rental
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSearchOpen(false)}
                    className="rounded-full bg-slate-100 p-2 text-slate-700 transition hover:bg-slate-200"
                    aria-label="Close search"
                  >
                    <RxCross2 className="text-xl" />
                  </button>
                </div>
                <div className="px-6 py-6">
                  <PropertySearchForm
                    filters={activeSearchFilters}
                    onFieldChange={handleSearchFilterChange}
                    onSubmit={handleSearchSubmit}
                    onReset={resetSearchFilters}
                    showSort={false}
                    submitLabel="Search"
                    resetLabel="Reset"
                  />
                </div>
              </div>
            </div>,
            document.body
          )
        : null}

      {mobileSearchOpen
        ? ReactDOM.createPortal(
            <div className="fixed inset-0 z-[10000] md:hidden">
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setMobileSearchOpen(false)}
              />
              <div className="absolute left-0 right-0 top-0 bg-white shadow-2xl animate-fade-in-down">
                <form
                  onSubmit={handleSearchSubmit}
                  className="flex items-center gap-3 border-b border-gray-100 px-4 py-3"
                >
                  <button
                    type="submit"
                    className="text-gray-500 transition-colors hover:text-gray-700"
                    aria-label="Search properties"
                  >
                    <FiSearch className="text-xl" />
                  </button>
                  <input
                    type="text"
                    placeholder="Search by area, sub-area, property ID..."
                    className="flex-1 bg-transparent py-2 text-base text-gray-700 outline-none placeholder-gray-400"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    autoFocus
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="text-gray-400 transition-colors hover:text-gray-600"
                    >
                      <RxCross2 className="text-xl" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      setMobileSearchOpen(false)
                      setSearchQuery('')
                    }}
                    className="text-base font-medium text-[#1E73B8]"
                  >
                    Cancel
                  </button>
                </form>
                <div className="border-b border-gray-100 px-4 py-4">
                  <PropertySearchForm
                    filters={activeSearchFilters}
                    onFieldChange={handleSearchFilterChange}
                    onSubmit={handleSearchSubmit}
                    onReset={resetSearchFilters}
                    showSort={false}
                    submitLabel="Search"
                    resetLabel="Reset"
                    compact
                  />
                </div>
                <div className="overflow-y-auto" style={{ maxHeight: '70vh' }}>
                  {searchQuery && searchResults.length > 0 ? (
                    <div className="space-y-2 p-3">
                      {searchResults.map((item) => (
                        <Link
                          key={item.id}
                          to={buildListDetailsHref(item.id)}
                          onClick={handleResultClick}
                          className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 p-3 transition-all duration-200 hover:bg-[#1E73B8]/10"
                        >
                          <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-gray-200">
                            <PropertyThumbnailImage
                              src={item.primary_image}
                              alt={item.category}
                              propertyType={item.property_type}
                              category={item.category}
                              pricing={item.pricing}
                              fallbackTextClassName="space-y-0"
                              compact
                            />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="text-xs font-bold text-[#1E73B8]">
                                #{item.property_id_number || ''}
                              </span>
                              <p className="truncate text-sm font-medium text-gray-800">
                                {item.category || 'Property'}
                              </p>
                            </div>
                            <p className="truncate text-xs text-gray-500">
                              {item.location?.area || ''}, {item.location?.state_district || ''}
                            </p>
                            <p className="mt-1 text-sm font-bold text-[#1E73B8]">
                              <RentDisplay pricing={item.pricing} prefix="৳" />
                            </p>
                          </div>
                        </Link>
                      ))}
                      <Link
                        to={searchHref}
                        onClick={handleResultClick}
                        className="block w-full rounded-xl bg-[#1E73B8] py-2.5 text-center font-medium text-white transition-colors hover:bg-[#1665a0]"
                      >
                        View All Results
                      </Link>
                    </div>
                  ) : searchQuery && searchLoading ? (
                    <div className="py-16 text-center">
                      <FiSearch className="mx-auto mb-3 animate-pulse text-4xl text-gray-300" />
                      <p className="text-gray-500">Loading properties...</p>
                    </div>
                  ) : searchQuery ? (
                    <div className="py-16 text-center">
                      <FiSearch className="mx-auto mb-3 text-4xl text-gray-300" />
                      <p className="text-gray-500">No properties found</p>
                      <p className="mt-1 text-sm text-gray-400">
                        Try a different search term
                      </p>
                    </div>
                  ) : (
                    <div className="py-16 text-center">
                      <FiSearch className="mx-auto mb-3 text-4xl text-gray-300" />
                      <p className="text-gray-500">Search for properties</p>
                      <p className="mt-1 text-sm text-gray-400">
                        Enter property ID, area, sub-area or category
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  )
}
