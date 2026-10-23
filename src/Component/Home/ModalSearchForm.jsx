import React, { useCallback, useMemo, useState } from 'react'
import { RxCross2 } from 'react-icons/rx'
import { FiSearch } from 'react-icons/fi'
import { HOME_CATEGORIES } from './categoryConfig'
import {
  DEFAULT_SEARCH_FILTERS,
  getLocationOptions,
  updateSearchFilters,
} from './propertySearch'
import { useLanguage } from '../../i18n/useLanguage'

const ModalSearchForm = ({
  isOpen = false,
  onClose,
  onSubmit,
  initialFilters = DEFAULT_SEARCH_FILTERS,
}) => {
  const [filters, setFilters] = useState({ ...DEFAULT_SEARCH_FILTERS, ...initialFilters })
  const [selectedCategory, setSelectedCategory] = useState(filters.category || 'All')

  const { t, tv } = useLanguage()
  const locationOptions = useMemo(() => getLocationOptions(filters), [filters])

  const handleFieldChange = useCallback((field, value) => {
    setFilters((current) => updateSearchFilters(current, field, value))
  }, [])

  const handleCategoryClick = useCallback((category) => {
    const newCategory = selectedCategory === category ? 'All' : category
    setSelectedCategory(newCategory)
    handleFieldChange('category', newCategory)
  }, [selectedCategory, handleFieldChange])

  const handleSubmit = useCallback((event) => {
    event.preventDefault()
    const searchFilters = { ...filters, category: selectedCategory }
    onSubmit(searchFilters)
  }, [filters, selectedCategory, onSubmit])

  const handleCancel = useCallback(() => {
    onClose()
  }, [onClose])

  const isDistrictDisabled = !filters.division
  const isAreaDisabled = !filters.division

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-lg font-bold text-gray-800">{t('search.overlay.title')}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label={t('search.overlay.close')}
          >
            <RxCross2 className="text-xl" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="space-y-4 p-5">
          {/* Location Input */}
          <div>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFieldChange('search', e.target.value)}
              placeholder={t('search.overlay.locationPlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Property ID Input */}
          <div className="relative">
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleFieldChange('search', e.target.value)}
              placeholder={t('search.overlay.propertyIdPlaceholder')}
              className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-sm text-gray-700 placeholder-gray-400 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            <FiSearch className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* OR Divider */}
          <div className="relative flex items-center">
            <div className="flex-1 border-t border-gray-300" />
            <span className="mx-4 text-sm text-gray-500">{t('search.overlay.or')}</span>
            <div className="flex-1 border-t border-gray-300" />
          </div>

          {/* Category Section */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">{t('search.form.category')}</label>
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
                  {tv('categories', category)}
                </button>
              ))}
            </div>
          </div>

          {/* Division Dropdown */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">{t('search.form.division')}</label>
            <select
              value={filters.division}
              onChange={(e) => handleFieldChange('division', e.target.value)}
              className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">{t('search.overlay.selectDivision')}</option>
              {locationOptions.divisions.map((division) => (
                <option key={division} value={division}>
                  {tv('divisions', division)}
                </option>
              ))}
            </select>
          </div>

          {/* District Dropdown */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">{t('search.form.district')}</label>
            <select
              value={filters.district}
              onChange={(e) => handleFieldChange('district', e.target.value)}
              disabled={isDistrictDisabled}
              className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">
                {isDistrictDisabled ? t('search.overlay.selectDivisionFirst') : t('search.overlay.selectDistrict')}
              </option>
              {locationOptions.districts.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </div>

          {/* Area/Thana Dropdown */}
          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">{t('search.overlay.areaThanaWithColon')}</label>
            <select
              value={filters.upazilla}
              onChange={(e) => handleFieldChange('upazilla', e.target.value)}
              disabled={isAreaDisabled}
              className="w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm text-gray-700 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
            >
              <option value="">
                {isAreaDisabled ? t('search.overlay.selectDivisionFirst') : t('search.overlay.selectArea')}
              </option>
              {locationOptions.upazillas.map((upazilla) => (
                <option key={upazilla} value={upazilla}>
                  {upazilla}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-lg bg-gray-200 px-6 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-300"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              {t('common.search')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ModalSearchForm
