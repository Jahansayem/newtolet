'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { FiX } from 'react-icons/fi'
import EmptyState from '../../components/ui/EmptyState'
import RentDisplay from '../../components/RentDisplay'
import { useLanguage } from '../../i18n/useLanguage'
import { buildListDetailsHref } from '../../lib/routePaths'
import { buildCompareRows } from '../../lib/propertyCompare.js'
import {
  COMPARE_PROPERTIES_BROWSER_EVENT,
  MAX_COMPARE_ITEMS,
  clearComparedProperties,
  getComparedProperties,
  getComparedPropertyIds,
  removeComparedProperty,
} from '../../services/propertyCompareService'

/**
 * Side-by-side comparison of up to MAX_COMPARE_ITEMS listings the visitor added with "Add to
 * Compare" on a listing card. The list lives on this device (localStorage), so no login is needed.
 * Rows where the listings differ are highlighted.
 */
const ComparePage = () => {
  const { t, tv, fd } = useLanguage()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [removedCount, setRemovedCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setFailed(false)
    try {
      const { items: nextItems, missingIds } = await getComparedProperties(getComparedPropertyIds())
      setItems(nextItems)
      if (missingIds.length) {
        // Listings that were rented, expired or removed since they were added.
        missingIds.forEach((id) => removeComparedProperty(id))
        setRemovedCount(missingIds.length)
      }
    } catch {
      setFailed(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    // Another tab (or a card on this page) changed the list: drop removed listings without a refetch.
    const sync = () => {
      const ids = getComparedPropertyIds()
      setItems((current) => {
        const kept = current.filter((item) => ids.includes(item.id))
        if (ids.some((id) => !current.some((item) => item.id === id))) void load()
        return kept
      })
    }
    window.addEventListener(COMPARE_PROPERTIES_BROWSER_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(COMPARE_PROPERTIES_BROWSER_EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [load])

  const rows = useMemo(() => buildCompareRows(items), [items])

  const formatValue = useCallback((key, value, item) => {
    const blank = <span className="text-muted">{t('common.na')}</span>
    if (value === '' || value === null || value === undefined || (Array.isArray(value) && !value.length)) {
      return key === 'facilities' ? <span className="text-muted">{t('comparePage.noFacilities')}</span> : blank
    }

    switch (key) {
      case 'rent':
        return (
          <RentDisplay
            pricing={{ rent_amount_bdt: item.rent_amount_bdt, rent_period: item.rent_period, is_rent_negotiable: item.is_rent_negotiable }}
            prefix="৳ "
            suffix={t('listing.card.perMonthShort')}
            className="font-semibold text-ink"
            suffixClassName="text-sm font-medium text-muted"
          />
        )
      case 'category':
        return tv('categories', value)
      case 'propertyType':
        return tv('propertyTypes', value)
      case 'floor':
        return tv('floorLevels', value)
      case 'occupancy':
        return tv('occupancy', value)
      case 'size':
        return t('comparePage.sizeValue', { size: value })
      case 'availableFrom': {
        const date = new Date(item.available_from)
        return Number.isNaN(date.getTime()) ? blank : fd(date, { month: 'short', year: 'numeric' })
      }
      case 'facilities':
        return (
          <ul className="flex flex-wrap gap-1.5">
            {value.map((amenity) => (
              <li key={amenity} className="ui-badge ui-badge-neutral">{tv('amenities', amenity)}</li>
            ))}
          </ul>
        )
      default:
        return String(value)
    }
  }, [fd, t, tv])

  const handleRemove = (id) => {
    removeComparedProperty(id)
    setItems((current) => current.filter((item) => item.id !== id))
  }

  const handleClear = () => {
    clearComparedProperties()
    setItems([])
  }

  const browseAction = (
    <Link to="/bd/property-listing" className="ui-btn ui-btn-primary ui-btn-sm">{t('comparePage.browse')}</Link>
  )

  return (
    <div className="site-shell min-h-[60vh] py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink md:text-3xl">{t('comparePage.title')}</h1>
          <p className="mt-1 text-body text-muted">{t('comparePage.subtitle', { max: MAX_COMPARE_ITEMS })}</p>
        </div>
        {items.length > 0 ? (
          <button type="button" onClick={handleClear} className="ui-btn ui-btn-ghost ui-btn-sm text-muted">
            {t('comparePage.clearAll')}
          </button>
        ) : null}
      </div>

      {removedCount > 0 ? (
        <p role="status" className="ui-note mt-4">{t('comparePage.unavailableRemoved', { count: removedCount })}</p>
      ) : null}

      <div className="mt-6">
        {loading ? (
          <div className="h-80 animate-pulse rounded-[var(--radius-panel)] bg-slate-200" aria-busy="true" aria-label={t('comparePage.loading')} />
        ) : failed ? (
          <EmptyState
            role="alert"
            title={t('comparePage.error')}
            action={<button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" onClick={() => void load()}>{t('common.retry')}</button>}
          />
        ) : items.length === 0 ? (
          <EmptyState title={t('comparePage.emptyTitle')} description={t('comparePage.emptyDescription')} action={browseAction} />
        ) : (
          <>
            {items.length === 1 ? <p className="ui-note mb-4">{t('comparePage.addOneMore')}</p> : null}
            {/* Wide tables scroll sideways on phones; the label column stays pinned. */}
            <div className="overflow-x-auto rounded-[var(--radius-panel)] border border-line bg-white">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <caption className="sr-only">{t('comparePage.tableCaption')}</caption>
                <thead>
                  <tr>
                    <th scope="col" className="sticky left-0 z-10 w-36 bg-white p-3 align-bottom text-caption font-semibold text-muted">
                      <span className="sr-only">{t('comparePage.featureColumn')}</span>
                    </th>
                    {items.map((item) => {
                      const title = t('comparePage.columnTitle', {
                        category: tv('categories', item.category) || '',
                        type: tv('propertyTypes', item.property_type) || '',
                      })
                      return (
                        <th key={item.id} scope="col" className="min-w-[180px] border-l border-line p-3 align-top font-normal">
                          <div className="relative">
                            <div className="aspect-[4/3] overflow-hidden rounded-xl bg-slate-100">
                              {item.primary_image ? (
                                <img src={item.primary_image} alt="" loading="lazy" className="h-full w-full object-cover" />
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemove(item.id)}
                              className="ui-btn ui-btn-icon absolute right-1.5 top-1.5 bg-white/90 text-ink shadow-raised hover:bg-white"
                              aria-label={t('comparePage.remove', { title })}
                            >
                              <FiX aria-hidden="true" />
                            </button>
                          </div>
                          <Link to={buildListDetailsHref(item.id)} className="mt-2 block font-semibold text-ink hover:text-brand">
                            {title}
                          </Link>
                          <span className="text-caption text-muted">{[item.area, item.state_district].filter(Boolean).join(', ')}</span>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.key} className={row.differs ? 'bg-brand-soft/40' : 'even:bg-canvas'}>
                      <th scope="row" className={`sticky left-0 z-10 border-t border-line p-3 align-top font-semibold text-ink ${row.differs ? 'bg-brand-soft' : 'bg-white'}`}>
                        {t(`comparePage.rows.${row.key}`)}
                        {row.differs ? <span className="sr-only"> ({t('comparePage.differs')})</span> : null}
                      </th>
                      {row.values.map((value, index) => (
                        <td key={items[index].id} className="border-l border-t border-line p-3 align-top text-ink">
                          {formatValue(row.key, value, items[index])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 flex items-center gap-2 text-caption text-muted">
              <span className="inline-block h-3 w-3 rounded-sm bg-brand-soft" aria-hidden="true" />
              {t('comparePage.differsLegend')}
            </p>
            {items.length < MAX_COMPARE_ITEMS ? <div className="mt-6">{browseAction}</div> : null}
          </>
        )}
      </div>
    </div>
  )
}

export default ComparePage
