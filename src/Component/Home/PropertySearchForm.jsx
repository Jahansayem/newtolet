import React, { useCallback, useMemo } from 'react'
import { HOME_CATEGORIES } from './categoryConfig'
import {
  DEFAULT_SEARCH_FILTERS,
  SORT_OPTIONS,
  getLocationOptions,
} from './propertySearch'

const baseInputClassName =
  'site-field text-sm'

const PropertySearchForm = ({
  filters = DEFAULT_SEARCH_FILTERS,
  onFieldChange,
  onSubmit,
  onReset,
  showSort = true,
  submitLabel = 'Search Properties',
  resetLabel = 'Clear All',
  compact = false,
  className = '',
}) => {
  const locationOptions = useMemo(() => getLocationOptions(filters), [filters])

  const handleChange = useCallback((field) => (event) => {
    onFieldChange?.(field, event.target.value)
  }, [onFieldChange])

  return (
    <form onSubmit={onSubmit} className={`space-y-4 ${className}`}>
      <div className={`grid gap-3 ${compact ? 'md:grid-cols-2' : 'md:grid-cols-3 xl:grid-cols-4'}`}>
        <label className='md:col-span-2 xl:col-span-4'>
          <span className='mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-gray-500'>
            Keyword
          </span>
          <input
            type='text'
            value={filters.search}
            onChange={handleChange('search')}
            placeholder='Search by area, sub-area, property ID or keyword'
            className={baseInputClassName}
          />
        </label>

        <label>
          <span className='mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-gray-500'>
            Division
          </span>
          <select value={filters.division} onChange={handleChange('division')} className={baseInputClassName}>
            <option value=''>All Divisions</option>
            {locationOptions.divisions.map((division) => (
              <option key={division} value={division}>
                {division}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className='mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-gray-500'>
            District
          </span>
          <select
            value={filters.district}
            onChange={handleChange('district')}
            className={baseInputClassName}
            disabled={!locationOptions.districts.length}
          >
            <option value=''>All Districts</option>
            {locationOptions.districts.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className='mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-gray-500'>
            Area
          </span>
          <select
            value={filters.upazilla}
            onChange={handleChange('upazilla')}
            className={baseInputClassName}
            disabled={!locationOptions.upazillas.length}
          >
            <option value=''>All Areas</option>
            {locationOptions.upazillas.map((upazilla) => (
              <option key={upazilla} value={upazilla}>
                {upazilla}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className='mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-gray-500'>
            Sub-area
          </span>
          <select
            value={filters.subArea}
            onChange={handleChange('subArea')}
            className={baseInputClassName}
            disabled={!locationOptions.subAreas.length}
          >
            <option value=''>All Sub-areas</option>
            {locationOptions.subAreas.map((subArea) => (
              <option key={subArea} value={subArea}>
                {subArea}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className='mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-gray-500'>
            Category
          </span>
          <select value={filters.category} onChange={handleChange('category')} className={baseInputClassName}>
            <option value='All'>All Categories</option>
            {HOME_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        {showSort && (
          <label>
            <span className='mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-gray-500'>
              Sort
            </span>
            <select value={filters.sort} onChange={handleChange('sort')} className={baseInputClassName}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className='flex flex-wrap items-center gap-3 pt-1'>
        <button
          type='submit'
          className='site-button-primary text-sm'
        >
          {submitLabel}
        </button>
        <button
          type='button'
          onClick={onReset}
          className='site-button-secondary text-sm'
        >
          {resetLabel}
        </button>
      </div>
    </form>
  )
}

export default PropertySearchForm
