import React, { useCallback, useId, useMemo, useState } from 'react'
import { FiChevronDown, FiChevronUp, FiSearch } from 'react-icons/fi'
import { HOME_CATEGORIES } from './categoryConfig'
import {
  DEFAULT_SEARCH_FILTERS,
  PROPERTY_TYPE_OPTIONS,
  ROOM_FILTER_OPTIONS,
  SORT_OPTIONS,
  getLocationOptions,
} from './propertySearch'
import { useLanguage } from '../../i18n/useLanguage'

const SECONDARY_KEYS = ['district', 'upazilla', 'subArea', 'propertyType', 'rooms']

const Field = ({ id, label, children }) => (
  <div className='min-w-0'>
    <label htmlFor={id} className='ui-label'>{label}</label>
    {children}
  </div>
)

/**
 * Two-tier search form: the fields tenants use on every search stay visible (keyword, division,
 * category, budget); district/area/type/rooms/sort sit behind a "More filters" disclosure that opens
 * automatically when one of them is already active.
 */
const PropertySearchForm = ({
  filters = DEFAULT_SEARCH_FILTERS,
  onFieldChange,
  onSubmit,
  onReset,
  showSort = true,
  submitLabel,
  resetLabel,
  className = '',
}) => {
  const { t, tv } = useLanguage()
  const idPrefix = useId()
  const locationOptions = useMemo(() => getLocationOptions(filters), [filters])
  const hasSecondaryValue = SECONDARY_KEYS.some((key) => filters[key] && filters[key] !== DEFAULT_SEARCH_FILTERS[key])
  const [moreOpen, setMoreOpen] = useState(hasSecondaryValue)
  const showMore = moreOpen || hasSecondaryValue

  const handleChange = useCallback((field) => (event) => {
    onFieldChange?.(field, event.target.value)
  }, [onFieldChange])

  const fieldId = (name) => `${idPrefix}-${name}`

  return (
    <form onSubmit={onSubmit} className={`space-y-4 ${className}`} role='search'>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-12 lg:items-end'>
        <div className='sm:col-span-2 lg:col-span-5'>
          <label htmlFor={fieldId('keyword')} className='ui-label'>{t('search.form.keyword')}</label>
          <div className='relative'>
            <FiSearch className='pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted' aria-hidden='true' />
            <input
              id={fieldId('keyword')}
              type='search'
              value={filters.search}
              onChange={handleChange('search')}
              placeholder={t('search.form.keywordPlaceholder')}
              className='ui-field pl-10'
            />
          </div>
        </div>

        <div className='lg:col-span-3'>
          <Field id={fieldId('division')} label={t('search.form.division')}>
            <select id={fieldId('division')} value={filters.division} onChange={handleChange('division')} className='ui-field'>
              <option value=''>{t('search.form.allDivisions')}</option>
              {locationOptions.divisions.map((division) => (
                <option key={division} value={division}>
                  {tv('divisions', division)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className='lg:col-span-2'>
          <Field id={fieldId('category')} label={t('search.form.category')}>
            <select id={fieldId('category')} value={filters.category} onChange={handleChange('category')} className='ui-field'>
              <option value='All'>{t('search.form.allCategories')}</option>
              {HOME_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {tv('categories', category)}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className='sm:col-span-2 lg:col-span-2'>
          <button type='submit' className='ui-btn ui-btn-primary w-full'>
            {submitLabel ?? t('search.form.submit')}
          </button>
        </div>
      </div>

      <div className='grid gap-3 sm:grid-cols-3 lg:grid-cols-12 lg:items-end'>
        <div className='lg:col-span-3'>
          <Field id={fieldId('minRent')} label={t('search.form.minRent')}>
            <input
              id={fieldId('minRent')}
              type='text'
              inputMode='numeric'
              value={filters.minPrice}
              onChange={handleChange('minPrice')}
              placeholder={t('search.form.minPlaceholder')}
              className='ui-field'
            />
          </Field>
        </div>
        <div className='lg:col-span-3'>
          <Field id={fieldId('maxRent')} label={t('search.form.maxRent')}>
            <input
              id={fieldId('maxRent')}
              type='text'
              inputMode='numeric'
              value={filters.maxPrice}
              onChange={handleChange('maxPrice')}
              placeholder={t('search.form.maxPlaceholder')}
              className='ui-field'
            />
          </Field>
        </div>
        {showSort ? (
          <div className='lg:col-span-3'>
            <Field id={fieldId('sort')} label={t('search.form.sort')}>
              <select id={fieldId('sort')} value={filters.sort} onChange={handleChange('sort')} className='ui-field'>
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {t(option.labelKey)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        ) : null}
        <div className='flex flex-wrap items-end gap-2 sm:col-span-3 lg:col-span-3 lg:justify-end'>
          <button
            type='button'
            onClick={() => setMoreOpen((current) => !current)}
            aria-expanded={showMore}
            aria-controls={fieldId('more')}
            className='ui-btn ui-btn-ghost ui-btn-sm text-brand'
          >
            <span>{t('search.form.moreFilters')}</span>
            {showMore ? <FiChevronUp aria-hidden='true' /> : <FiChevronDown aria-hidden='true' />}
          </button>
          <button type='button' onClick={onReset} className='ui-btn ui-btn-secondary ui-btn-sm'>
            {resetLabel ?? t('search.form.reset')}
          </button>
        </div>
      </div>

      <div id={fieldId('more')} className={showMore ? 'grid gap-3 border-t border-line pt-4 sm:grid-cols-2 lg:grid-cols-5' : 'hidden'}>
        <Field id={fieldId('district')} label={t('search.form.district')}>
          <select
            id={fieldId('district')}
            value={filters.district}
            onChange={handleChange('district')}
            className='ui-field'
            disabled={!locationOptions.districts.length}
          >
            <option value=''>{t('search.form.allDistricts')}</option>
            {locationOptions.districts.map((district) => (
              <option key={district} value={district}>
                {district}
              </option>
            ))}
          </select>
        </Field>

        <Field id={fieldId('area')} label={t('search.form.area')}>
          <select
            id={fieldId('area')}
            value={filters.upazilla}
            onChange={handleChange('upazilla')}
            className='ui-field'
            disabled={!locationOptions.upazillas.length}
          >
            <option value=''>{t('search.form.allAreas')}</option>
            {locationOptions.upazillas.map((upazilla) => (
              <option key={upazilla} value={upazilla}>
                {upazilla}
              </option>
            ))}
          </select>
        </Field>

        <Field id={fieldId('subArea')} label={t('search.form.subArea')}>
          <select
            id={fieldId('subArea')}
            value={filters.subArea}
            onChange={handleChange('subArea')}
            className='ui-field'
            disabled={!locationOptions.subAreas.length}
          >
            <option value=''>{t('search.form.allSubAreas')}</option>
            {locationOptions.subAreas.map((subArea) => (
              <option key={subArea} value={subArea}>
                {subArea}
              </option>
            ))}
          </select>
        </Field>

        <Field id={fieldId('propertyType')} label={t('search.form.propertyType')}>
          <select id={fieldId('propertyType')} value={filters.propertyType} onChange={handleChange('propertyType')} className='ui-field'>
            <option value='All'>{t('search.form.allTypes')}</option>
            {PROPERTY_TYPE_OPTIONS.map((propertyType) => (
              <option key={propertyType} value={propertyType}>
                {tv('propertyTypes', propertyType)}
              </option>
            ))}
          </select>
        </Field>

        <Field id={fieldId('rooms')} label={t('search.form.rooms')}>
          <select id={fieldId('rooms')} value={filters.rooms} onChange={handleChange('rooms')} className='ui-field'>
            <option value=''>{t('search.form.anyRooms')}</option>
            {ROOM_FILTER_OPTIONS.map((rooms) => (
              <option key={rooms} value={rooms}>
                {t('search.form.roomsOption', { rooms })}
              </option>
            ))}
          </select>
        </Field>
      </div>
    </form>
  )
}

export default PropertySearchForm
