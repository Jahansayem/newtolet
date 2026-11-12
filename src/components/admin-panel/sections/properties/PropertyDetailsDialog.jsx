'use client'

import React, { useEffect, useState } from 'react'
import { FiCheck, FiEdit2, FiStar, FiTrash2, FiX } from 'react-icons/fi'
import { getProperty } from '../../../../services/admin/properties'
import { getCompletenessFlags } from '../../../../lib/listingCompleteness'
import { buildAdminEditPropertyHref } from '../../../../lib/routePaths'
import { getPropertyDisplayLabel } from '../../../../utils/propertyDisplaySerial'
import Badge from '../../../ui/Badge'
import Button from '../../../ui/Button'
import Dialog from '../../../ui/Dialog'
import InlineAlert from '../../../ui/InlineAlert'
import KeyValueList from '../../../ui/KeyValueList'
import StatusPill from '../../../ui/StatusPill'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null)
const formatDateTime = (value) => (value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null)
const rentText = (listing) => {
  const amount = listing.rent_amount_bdt ? `৳${Number(listing.rent_amount_bdt).toLocaleString()} / ${listing.rent_period || 'month'}` : null
  if (amount) return listing.is_rent_negotiable ? `${amount} (negotiable)` : amount
  return listing.is_rent_negotiable ? 'Negotiable' : null
}

const Section = ({ title, children }) => (
  <section>
    <h3 className="mb-2 text-sm font-semibold text-ink">{title}</h3>
    {children}
  </section>
)

/**
 * Everything about one listing, for review without opening the editor: the
 * description next to every structured field, amenities, all photos, what
 * needs attention, and the moderation actions.
 *
 * `fallback` is the row from the list (shown at once); the full record is
 * loaded by id, so a link to a listing that is not on the current page works.
 */
export default function PropertyDetailsDialog({
  propertyId,
  fallback = null,
  heldIds = null,
  canModerate = false,
  canFeature = false,
  featuredBusy = false,
  onClose,
  onApprove,
  onReject,
  onEdit,
  onRemove,
  onToggleFeatured,
}) {
  const [detail, setDetail] = useState({ id: null, data: null, error: null })

  useEffect(() => {
    if (!propertyId) return undefined
    const controller = new AbortController()
    void getProperty(propertyId, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted || result.error?.code === 'ABORTED') return
      setDetail({ id: propertyId, data: result.data || null, error: result.error || null })
    })
    return () => controller.abort()
  }, [propertyId])

  const loaded = detail.id === propertyId ? detail : { data: null, error: null }
  const listing = propertyId ? loaded.data || fallback : null
  const isFull = Boolean(loaded.data)
  const status = listing && heldIds?.has(listing.id) ? 'approved' : listing?.status
  const label = listing ? getPropertyDisplayLabel(listing) || 'Listing' : 'Listing'
  const flags = listing ? getCompletenessFlags(listing) : []
  const submitter = listing?.submitted_by || {}

  const footer = listing ? (
    <div className="flex w-full flex-wrap gap-2" role="toolbar" aria-label="Listing actions">
      {canModerate && status !== 'approved' ? (
        <Button variant="primary" icon={<FiCheck />} onClick={() => onApprove?.(listing)}>
          Approve
        </Button>
      ) : null}
      {canModerate && status !== 'rejected' ? (
        <Button variant="danger-outline" icon={<FiX />} onClick={() => onReject?.(listing)}>
          Reject
        </Button>
      ) : null}
      <Button
        variant="secondary"
        icon={<FiEdit2 />}
        href={buildAdminEditPropertyHref(listing.id)}
        onClick={(event) => {
          event.preventDefault()
          onEdit?.(listing.id)
        }}
      >
        Edit listing
      </Button>
      {canFeature && status === 'approved' ? (
        <Button variant="secondary" icon={<FiStar />} busy={featuredBusy} onClick={() => onToggleFeatured?.(listing)}>
          {listing.is_featured ? 'Remove from featured' : 'Mark as featured'}
        </Button>
      ) : null}
      {canModerate && !listing.deleted_at ? (
        <Button variant="danger-outline" icon={<FiTrash2 />} onClick={() => onRemove?.(listing)}>
          Remove
        </Button>
      ) : null}
    </div>
  ) : null

  return (
    <Dialog
      open={Boolean(propertyId)}
      onClose={onClose}
      title={label}
      description={listing ? [listing.category, listing.property_type].filter(Boolean).join(' · ') : null}
      size="xl"
      fullScreenOnMobile
      footer={footer}
    >
      {!listing && loaded.error ? <InlineAlert variant="danger">This listing could not be loaded. {loaded.error.message}</InlineAlert> : null}
      {!listing && !loaded.error ? <p className="text-sm text-muted" role="status">Loading listing…</p> : null}
      {listing ? (
        <div className="space-y-5" data-testid="property-details">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill status={status} />
            {listing.is_featured ? <Badge variant="promoted">Featured</Badge> : null}
            {listing.isDuplicatePhone ? <Badge variant="danger">Duplicate phone ×{listing.duplicateCount}</Badge> : null}
            {listing.isAiSubmitted ? <Badge variant="brand">AI agent</Badge> : null}
            {listing.deleted_at ? <Badge variant="neutral">Removed</Badge> : null}
          </div>

          {isFull || !loaded.error ? null : <InlineAlert variant="warning">Only the fields from the list are shown. The full record could not be loaded: {loaded.error.message}</InlineAlert>}

          {flags.length > 0 ? (
            <InlineAlert variant="warning" title={`${flags.length} ${flags.length === 1 ? 'thing' : 'things'} to check`} data-testid="details-flags">
              <ul className="list-disc pl-5">
                {flags.map((flag) => (
                  <li key={flag.code + flag.label}>{flag.label}</li>
                ))}
              </ul>
            </InlineAlert>
          ) : null}

          <Section title="Description">
            <p className="whitespace-pre-wrap break-words rounded-[var(--radius-card)] border border-line bg-canvas p-3 text-sm text-ink" data-testid="details-description">
              {listing.short_description || 'No description'}
            </p>
          </Section>

          <Section title="Property">
            <KeyValueList
              columns={2}
              items={[
                { key: 'rent', label: 'Rent', value: rentText(listing) },
                { key: 'category', label: 'Category', value: listing.category },
                { key: 'type', label: 'Property type', value: listing.property_type },
                { key: 'rooms', label: 'Rooms', value: listing.total_rooms },
                { key: 'baths', label: 'Bathrooms', value: listing.total_bathrooms },
                { key: 'floor', label: 'Floor', value: listing.floor_level },
                { key: 'occupancy', label: 'Occupancy', value: listing.occupancy },
                { key: 'balcony', label: 'Balcony', value: isFull ? listing.balcony : undefined },
                { key: 'kitchen', label: 'Kitchen', value: isFull ? listing.total_kitchen : undefined },
                { key: 'living', label: 'Drawing / living rooms', value: isFull ? listing.living_rooms : undefined },
                { key: 'size', label: 'Size (sq ft)', value: isFull ? listing.room_size_sqft : undefined },
                { key: 'from', label: 'Available from', value: formatDate(listing.available_from) },
                { key: 'deadline', label: 'Deadline', value: formatDate(listing.deadline) },
              ]}
            />
          </Section>

          <Section title="Location">
            <KeyValueList
              columns={2}
              items={[
                { key: 'district', label: 'Division / district', value: listing.state_district },
                { key: 'area', label: 'Area', value: listing.area },
                { key: 'subArea', label: 'Sub-area', value: listing.sub_area },
                { key: 'sector', label: 'Sector', value: isFull ? listing.sector : undefined },
                { key: 'road', label: 'Road', value: isFull ? listing.road : undefined },
                { key: 'house', label: 'House / plot', value: isFull ? listing.house_plot : undefined },
                { key: 'map', label: 'Map position', value: isFull && listing.lat && listing.lng ? `${Number(listing.lat).toFixed(5)}, ${Number(listing.lng).toFixed(5)}` : undefined },
              ]}
            />
          </Section>

          <Section title="Amenities">
            {Array.isArray(listing.amenities) && listing.amenities.length > 0 ? (
              <ul className="flex flex-wrap gap-2" data-testid="details-amenities">
                {listing.amenities.map((amenity) => (
                  <li key={amenity}>
                    <Badge variant="neutral">{amenity}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">{Array.isArray(listing.amenities) ? 'None' : 'Not loaded'}</p>
            )}
          </Section>

          <Section title={`Photos (${listing.images?.length ?? 0})`}>
            {listing.images?.length ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4" data-testid="details-photos">
                {listing.images.map((src, index) => (
                  <a key={src} href={src} target="_blank" rel="noreferrer" aria-label={`Open photo ${index + 1} in a new tab`}>
                    <img src={src} alt={`Listing photo ${index + 1}`} className="h-28 w-full rounded-[var(--radius-card)] object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">No photos</p>
            )}
          </Section>

          <Section title="Contact and submitter">
            <KeyValueList
              columns={2}
              items={[
                { key: 'contact', label: 'Contact number', value: listing.contact_number },
                { key: 'submitter', label: 'Submitted by', value: listing.isAiSubmitted ? 'AI agent' : submitter.name || submitter.email || submitter.phone || 'Unknown user' },
                { key: 'submitterEmail', label: 'Submitter email', value: submitter.email },
                { key: 'submitterPhone', label: 'Submitter phone', value: submitter.phone },
                { key: 'submitted', label: 'Submitted', value: formatDateTime(listing.created_at) },
                { key: 'updated', label: 'Last updated', value: isFull ? formatDateTime(listing.updated_at) : undefined },
              ]}
            />
          </Section>

          <Section title="Moderation">
            <KeyValueList
              columns={2}
              items={[
                { key: 'reviewed', label: 'Reviewed', value: formatDateTime(listing.reviewed_at) },
                { key: 'reason', label: 'Reason shown to owner', value: listing.moderation_reason },
                { key: 'note', label: 'Internal note', value: listing.internal_note },
                { key: 'removed', label: 'Removed', value: formatDateTime(listing.deleted_at) },
              ]}
            />
          </Section>
        </div>
      ) : null}
    </Dialog>
  )
}
