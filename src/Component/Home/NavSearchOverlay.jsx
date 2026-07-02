'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import ReactDOM from 'react-dom'
import { RxCross2 } from 'react-icons/rx'
import { FiSearch } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import { getSearchableProperties } from '../../services/propertyCatalogService'
import {
  buildSearchHref as buildPropertySearchHref,
  getLocationOptions,
  updateSearchFilters,
} from './propertySearch'
import { DEFAULT_SEARCH_FILTERS } from './propertySearchCore'
import { HOME_CATEGORIES } from './categoryConfig'

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

  const locationOptions = useMemo(() => getLocationOptions(searchFilters), [searchFilters])

  const activeSearchFilters = useMemo(
    () => ({ ...searchFilters, search: searchQuery, category: selectedCategory }),
    [searchFilters, searchQuery, selectedCategory]
  )
  const searchHref = useMemo(
    () => buildPropertySearchHref(activeSearchFilters),
    [activeSearchFilters]
  )

  const resetSearchFilters = () => {
    setSearchQuery('')
    setSearchFilters({ ...DEFAULT_SEARCH_FILTERS })
    setSelectedCategory('All')
  }

  const handleSearchSubmit = useCallback(() => {
    navigate(searchHref)
    setSearchOpen(false)
    setMobileSearchOpen(false)
    resetSearchFilters()
    closeMenu()
  }, [searchHref, navigate, setSearchOpen, setMobileSearchOpen, closeMenu])

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

  const isDistrictDisabled = !searchFilters.division
  const isAreaDisabled = !searchFilters.division

  // Desktop Modal Search
  const renderDesktopSearch = () => {
    if (!searchOpen) return null

    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[10001] hidden md:flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
            <h2 className="text-lg font-bold text-gray-800">Property search</h2>
            <button
              type="button"
              onClick={() => setSearchOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
              aria-label="Close search"
            >
              <RxCross2 className="text-xl" />
            </button>
          </div>

          {/* Form Content */}
          <div className="space-y-4 p-5">
            {/* Location Input */}
            <div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleFieldChange('search', e.target.value)}
                placeholder="Search by location"
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Property ID Input */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleFieldChange('search', e.target.value)}
                placeholder="Property ID.."
                className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
              <FiSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>

            {/* OR Divider */}
            <div className="relative flex items-center">
              <div className="flex-1 border-t border-gray-300" />
              <span className="mx-4 text-sm text-gray-500">OR</span>
              <div className="flex-1 border-t border-gray-300" />
            </div>

            {/* Category Section */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Category</label>
              <div className="flex flex-wrap gap-2">
                {HOME_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategoryClick(category)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      selectedCategory === category
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Division Dropdown */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Division</label>
              <div className="relative">
                <select
                  value={searchFilters.division}
                  onChange={(e) => handleFieldChange('division', e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">Select division</option>
                  {locationOptions.divisions.map((division) => (
                    <option key={division} value={division}>
                      {division}
                    </option>
                  ))}
                </select>
                <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* District Dropdown */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">District</label>
              <div className="relative">
                <select
                  value={searchFilters.district}
                  onChange={(e) => handleFieldChange('district', e.target.value)}
                  disabled={isDistrictDisabled}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">
                    {isDistrictDisabled ? 'Select division first' : 'Select district'}
                  </option>
                  {locationOptions.districts.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
                <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Area/Thana Dropdown */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Area / Thana :</label>
              <div className="relative">
                <select
                  value={searchFilters.upazilla}
                  onChange={(e) => handleFieldChange('upazilla', e.target.value)}
                  disabled={isAreaDisabled}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">
                    {isAreaDisabled ? 'Select division first' : 'Select area'}
                  </option>
                  {locationOptions.upazillas.map((upazilla) => (
                    <option key={upazilla} value={upazilla}>
                      {upazilla}
                    </option>
                  ))}
                </select>
                <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="rounded-lg bg-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSearchSubmit}
                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  // Mobile Search Overlay
  const renderMobileSearch = () => {
    if (!mobileSearchOpen) return null

    return ReactDOM.createPortal(
      <div className="fixed inset-0 z-[10000] md:hidden">
        <div
          className="absolute inset-0 bg-black/50"
          onClick={() => setMobileSearchOpen(false)}
        />
        <div className="absolute inset-0 flex flex-col bg-white animate-fade-in-down">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSearchSubmit(); }}
            className="flex items-center gap-3 border-b border-gray-100 px-4 py-3 shrink-0"
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
          <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4">
            {/* Category Section */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Category</label>
              <div className="flex flex-wrap gap-2">
                {HOME_CATEGORIES.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategoryClick(category)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                      selectedCategory === category
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            {/* Division Dropdown */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Division</label>
              <div className="relative">
                <select
                  value={searchFilters.division}
                  onChange={(e) => handleFieldChange('division', e.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select division</option>
                  {locationOptions.divisions.map((division) => (
                    <option key={division} value={division}>
                      {division}
                    </option>
                  ))}
                </select>
                <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* District Dropdown */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">District</label>
              <div className="relative">
                <select
                  value={searchFilters.district}
                  onChange={(e) => handleFieldChange('district', e.target.value)}
                  disabled={isDistrictDisabled}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">
                    {isDistrictDisabled ? 'Select division first' : 'Select district'}
                  </option>
                  {locationOptions.districts.map((district) => (
                    <option key={district} value={district}>
                      {district}
                    </option>
                  ))}
                </select>
                <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Area/Thana Dropdown */}
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Area / Thana</label>
              <div className="relative">
                <select
                  value={searchFilters.upazilla}
                  onChange={(e) => handleFieldChange('upazilla', e.target.value)}
                  disabled={isAreaDisabled}
                  className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                >
                  <option value="">
                    {isAreaDisabled ? 'Select division first' : 'Select area'}
                  </option>
                  {locationOptions.upazillas.map((upazilla) => (
                    <option key={upazilla} value={upazilla}>
                      {upazilla}
                    </option>
                  ))}
                </select>
                <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setMobileSearchOpen(false)}
                className="rounded-lg bg-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSearchSubmit}
                className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )
  }

  if ((!searchOpen && !mobileSearchOpen) || typeof document === 'undefined') {
    return null
  }

  return (
    <>
      {renderDesktopSearch()}
      {renderMobileSearch()}
    </>
  )
}
