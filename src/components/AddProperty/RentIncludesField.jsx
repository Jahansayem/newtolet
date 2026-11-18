'use client'

import React from 'react'
import { useLanguage } from '../../i18n/useLanguage'
import { RENT_INCLUDES_OPTIONS, normalizeRentIncludes, toggleRentIncludes } from '../../lib/listingAvailability.js'

/** "Rent includes" checkboxes, shared by the add and edit property forms (owner and admin). */
const RentIncludesField = ({ idPrefix, value, onChange }) => {
  const { t, tv } = useLanguage()
  const selected = normalizeRentIncludes(value)
  const legendId = `${idPrefix}-rentIncludes-legend`

  return (
    <fieldset aria-labelledby={legendId}>
      <legend id={legendId} className='ui-label text-[15px]'>{t('addProperty.fields.rentIncludes')}</legend>
      <p className='-mt-1 mb-2 text-caption text-muted'>{t('addProperty.fields.rentIncludesHint')}</p>
      <div className='grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3'>
        {RENT_INCLUDES_OPTIONS.map((option) => {
          const id = `${idPrefix}-rentIncludes-${option}`
          return (
            <label key={option} htmlFor={id} className='flex min-h-11 items-center gap-2 text-sm text-ink'>
              <input
                id={id}
                type='checkbox'
                checked={selected.includes(option)}
                onChange={() => onChange(toggleRentIncludes(selected, option))}
                className='h-4 w-4 accent-brand'
              />
              {tv('rentIncludes', option)}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}

export default RentIncludesField
