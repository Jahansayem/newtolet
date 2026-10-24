'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { FiArrowDown, FiArrowUp, FiPlus, FiX } from 'react-icons/fi'
import CoverPhotoManagement from '../../../Component/Admin/CoverPhotoManagement.jsx'
import { CONTACT_INFO_FIELDS, MAX_FEATURED_LISTINGS, getSiteSettings, updateSiteSettings } from '../../../services/admin/settings'
import { listProperties, listPropertiesByIds } from '../../../services/admin/properties'
import { useAdminMutation } from '../hooks/useAdminMutation'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import { useEntityParam } from '../hooks/useEntityParam'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import EmptyState from '../../ui/EmptyState'
import InlineAlert from '../../ui/InlineAlert'
import Skeleton from '../../ui/Skeleton'
import Tabs, { useTabPanelProps } from '../../ui/Tabs'

const VIEWS = [
  { key: 'cover-photos', label: 'Cover photos' },
  { key: 'featured', label: 'Featured listings' },
  { key: 'contact', label: 'Site contact' },
]

const useUnsavedGuard = (dirty) => {
  useEffect(() => {
    if (!dirty || typeof window === 'undefined') return undefined
    const handler = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])
}

const useSiteSettings = () => {
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState(null)
  const load = useCallback(async () => {
    const result = await getSiteSettings()
    if (result.error) setError(result.error)
    else {
      setError(null)
      setSettings(result.data)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  return { settings, setSettings, error, reload: load }
}

const AdminContentSection = () => {
  const [view, setView] = useEntityParam('view')
  const active = VIEWS.some((entry) => entry.key === view) ? view : 'cover-photos'
  const panelProps = useTabPanelProps()

  return (
    <div className="space-y-5">
      <Tabs tabs={VIEWS} value={active} onChange={(key) => setView(key === 'cover-photos' ? null : key)} ariaLabel="Content areas" />
      <div {...panelProps(active)} className="focus-visible:outline-none">
        {active === 'cover-photos' ? <CoverPhotoManagement /> : null}
        {active === 'featured' ? <FeaturedListingsEditor /> : null}
        {active === 'contact' ? <ContactInfoForm /> : null}
      </div>
    </div>
  )
}

const listingLabel = (property) => `${property.category || 'Listing'} in ${property.area || property.state_district || '—'}${property.property_id_number ? ` · ID ${property.property_id_number}` : ''}`

const FeaturedListingsEditor = () => {
  const { settings, setSettings, error, reload } = useSiteSettings()
  const [items, setItems] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 300)
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    if (!settings) return
    let active = true
    void listPropertiesByIds(settings.featured_property_ids).then((result) => {
      if (!active) return
      if (result.error) setLoadError(result.error)
      else {
        setLoadError(null)
        setItems(result.data)
      }
    })
    return () => {
      active = false
    }
  }, [settings])

  useEffect(() => {
    if (debounced.trim().length < 2) {
      setResults([])
      return undefined
    }
    const controller = new AbortController()
    setSearching(true)
    void listProperties({ search: debounced.trim(), pageSize: 6, filters: { status: 'approved' } }, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return
      setSearching(false)
      setResults(result.error ? [] : result.data || [])
    })
    return () => controller.abort()
  }, [debounced])

  const savedIds = settings?.featured_property_ids || []
  const currentIds = (items || []).map((item) => item.id)
  const dirty = Boolean(items) && JSON.stringify(savedIds) !== JSON.stringify(currentIds)
  useUnsavedGuard(dirty)

  const saveMutation = useAdminMutation((ids) => updateSiteSettings({ featured_property_ids: ids }), {
    successMessage: 'Featured listings saved',
    invalidate: ['settings'],
    onSuccess: (result) => setSettings(result.data),
  })

  const move = (index, delta) =>
    setItems((current) => {
      const next = [...current]
      const target = index + delta
      if (target < 0 || target >= next.length) return current
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  if (error) {
    return (
      <InlineAlert variant={error.permissionDenied ? 'permission' : 'danger'} title="Settings could not be loaded" action={<Button size="sm" onClick={() => void reload()}>Retry</Button>}>
        {error.message}
      </InlineAlert>
    )
  }

  return (
    <div className="space-y-5">
      <section aria-labelledby="featured-heading" className="ui-card space-y-4 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="featured-heading" className="text-base font-semibold text-ink">
              Featured listings
            </h2>
            <p className="text-caption text-muted">
              Shown first on the homepage, in this order. Up to {MAX_FEATURED_LISTINGS}. Only approved listings can be featured.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {dirty ? <Badge variant="warning">Unsaved changes</Badge> : null}
            <Button variant="primary" disabled={!dirty} busy={saveMutation.busy} busyLabel="Saving…" onClick={() => void saveMutation.run(currentIds)}>
              Save order
            </Button>
          </div>
        </div>

        {loadError ? (
          <InlineAlert variant="danger" title="Featured listings could not be loaded">
            {loadError.message}
          </InlineAlert>
        ) : !items ? (
          <div className="space-y-2" aria-hidden="true">
            <Skeleton />
            <Skeleton />
            <Skeleton width="70%" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="Nothing featured yet" description="Search for an approved listing below and add it." />
        ) : (
          <ol className="divide-y divide-line rounded-[var(--radius-card)] border border-line" aria-label="Featured listings in display order">
            {items.map((property, index) => (
              <li key={property.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                <span className="w-6 text-center text-caption font-semibold text-muted" aria-hidden="true">
                  {index + 1}
                </span>
                {property.primary_image ? <img src={property.primary_image} alt="" className="h-12 w-16 rounded object-cover" /> : <span className="h-12 w-16 rounded bg-canvas" aria-hidden="true" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">{listingLabel(property)}</span>
                  <span className="block truncate text-caption text-muted">
                    {property.short_description || ''}
                    {property.status !== 'approved' ? ' · not approved' : ''}
                  </span>
                </span>
                {property.status !== 'approved' ? <Badge variant="warning">Hidden until approved</Badge> : null}
                <span className="flex items-center gap-1">
                  <Button size="sm" variant="ghost" iconOnly aria-label={`Move ${listingLabel(property)} up`} disabled={index === 0} onClick={() => move(index, -1)}>
                    <FiArrowUp />
                  </Button>
                  <Button size="sm" variant="ghost" iconOnly aria-label={`Move ${listingLabel(property)} down`} disabled={index === items.length - 1} onClick={() => move(index, 1)}>
                    <FiArrowDown />
                  </Button>
                  <Button size="sm" variant="ghost" iconOnly aria-label={`Remove ${listingLabel(property)} from featured`} onClick={() => setItems((current) => current.filter((entry) => entry.id !== property.id))}>
                    <FiX />
                  </Button>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section aria-labelledby="featured-add" className="ui-card space-y-3 p-5">
        <h3 id="featured-add" className="text-sm font-semibold text-ink">
          Add a listing
        </h3>
        <div>
          <label className="ui-label" htmlFor="featured-search">
            Search approved listings
          </label>
          <input id="featured-search" type="search" className="ui-field" placeholder="Listing ID, area or title" value={search} onChange={(event) => setSearch(event.target.value)} autoComplete="off" />
          <p className="ui-help">{searching ? 'Searching…' : 'Type at least two characters.'}</p>
        </div>
        {results.length ? (
          <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line" aria-label="Search results">
            {results.map((property) => {
              const added = currentIds.includes(property.id)
              const full = currentIds.length >= MAX_FEATURED_LISTINGS
              return (
                <li key={property.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{listingLabel(property)}</span>
                    <span className="block truncate text-caption text-muted">{property.short_description || ''}</span>
                  </span>
                  <Button size="sm" variant="secondary" icon={<FiPlus />} disabled={added || full || !items} onClick={() => setItems((current) => [...current, property])}>
                    {added ? 'Added' : full ? 'Limit reached' : 'Add'}
                  </Button>
                </li>
              )
            })}
          </ul>
        ) : null}
      </section>
    </div>
  )
}

const ContactInfoForm = () => {
  const { settings, setSettings, error, reload } = useSiteSettings()
  const [draft, setDraft] = useState(null)
  useEffect(() => {
    if (settings && draft === null) setDraft({ ...settings.contact_info })
  }, [settings, draft])

  const saved = useMemo(() => JSON.stringify(settings?.contact_info || {}), [settings])
  const dirty = draft !== null && JSON.stringify(Object.fromEntries(Object.entries(draft).filter(([, value]) => String(value || '').trim()))) !== saved
  useUnsavedGuard(dirty)

  const saveMutation = useAdminMutation((contactInfo) => updateSiteSettings({ contact_info: contactInfo }), {
    successMessage: 'Site contact saved',
    invalidate: ['settings'],
    onSuccess: (result) => {
      setSettings(result.data)
      setDraft({ ...result.data.contact_info })
    },
  })

  if (error) {
    return (
      <InlineAlert variant={error.permissionDenied ? 'permission' : 'danger'} title="Settings could not be loaded" action={<Button size="sm" onClick={() => void reload()}>Retry</Button>}>
        {error.message}
      </InlineAlert>
    )
  }

  return (
    <form
      className="ui-card space-y-4 p-5"
      aria-labelledby="contact-heading"
      onSubmit={(event) => {
        event.preventDefault()
        const cleaned = Object.fromEntries(Object.entries(draft || {}).map(([key, value]) => [key, String(value || '').trim()]).filter(([, value]) => value))
        void saveMutation.run(cleaned)
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="contact-heading" className="text-base font-semibold text-ink">
            Site contact details
          </h2>
          <p className="text-caption text-muted">Shown in the footer and on the contact page.</p>
        </div>
        {dirty ? <Badge variant="warning">Unsaved changes</Badge> : null}
      </div>
      {!draft ? (
        <div className="space-y-3" aria-hidden="true">
          <Skeleton />
          <Skeleton />
          <Skeleton width="60%" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {CONTACT_INFO_FIELDS.map((field) => (
            <div key={field.key} className={field.key === 'address' ? 'sm:col-span-2' : ''}>
              <label className="ui-label" htmlFor={`contact-${field.key}`}>
                {field.label}
              </label>
              <input
                id={`contact-${field.key}`}
                type={field.type}
                className="ui-field"
                placeholder={field.placeholder}
                value={draft[field.key] || ''}
                onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))}
              />
            </div>
          ))}
        </div>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="ghost" disabled={!dirty || saveMutation.busy} onClick={() => setDraft({ ...(settings?.contact_info || {}) })}>
          Discard
        </Button>
        <Button type="submit" variant="primary" disabled={!dirty} busy={saveMutation.busy} busyLabel="Saving…">
          Save contact details
        </Button>
      </div>
    </form>
  )
}

export default AdminContentSection
