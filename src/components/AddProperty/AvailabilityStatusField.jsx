'use client'

import React from 'react'
import { useLanguage } from '../../i18n/useLanguage'
import { AVAILABILITY_STATUSES, normalizeAvailabilityStatus } from '../../lib/listingAvailability.js'

/** Availability select on the edit form (owner and admin). New listings start as 'available'. */
const AvailabilityStatusField = ({ idPrefix, value, onChange }) => {
  const { t, tv } = useLanguage()
  const id = `${idPrefix}-availabilityStatus`

  return (
    <div>
      <label htmlFor={id} className='ui-label text-[15px]'>{t('addProperty.fields.availabilityStatus')}</label>
      <select
        id={id}
        value={normalizeAvailabilityStatus(value)}
        onChange={(event) => onChange(event.target.value)}
        className='ui-field'
        aria-describedby={`${id}-hint`}
      >
        {AVAILABILITY_STATUSES.map((status) => (
          <option key={status} value={status}>{tv('availabilityStatuses', status)}</option>
        ))}
      </select>
      <p id={`${id}-hint`} className='mt-1 text-caption text-muted'>{t('addProperty.fields.availabilityStatusHint')}</p>
    </div>
  )
}

export default AvailabilityStatusField
