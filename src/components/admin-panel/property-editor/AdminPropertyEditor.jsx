'use client'

import React, { useEffect, useState } from 'react'
import { FiArrowLeft } from 'react-icons/fi'
import { EditPropertyForm } from '../../../Component/Navber/EditProperty'
import { getNextPendingInList, getProperty, setPropertyStatus, softDeleteProperty } from '../../../services/admin/properties'
import { useAdminPermissions } from '../../../contexts/AdminAccessContext'
import { PERMISSIONS } from '../../../lib/adminPermissions'
import { getPropertyDisplayLabel } from '../../../utils/propertyDisplaySerial'
import { useAdminMutation } from '../hooks/useAdminMutation'
import { REJECT_REASONS } from '../propertyRejectReasons'
import { useToast } from '../../ui/ToastProvider'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import InlineAlert from '../../ui/InlineAlert'
import ReasonDialog from '../../ui/ReasonDialog'
import StatusPill from '../../ui/StatusPill'
import EditorActionBar from './EditorActionBar'
import SamePhonePanel from './SamePhonePanel'

const formatDateTime = (value) => (value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')
const submitterLabel = (listing) => listing?.submitted_by?.name || listing?.submitted_by?.email || listing?.submitted_by?.phone || 'Unknown user'

/**
 * Admin edit screen for one listing, inside the admin shell: who and what it
 * is, the shared edit form, the other listings with the same phone, and a
 * sticky bar with every moderation action.
 *
 * listContext: { sort, filters, search } of the list the admin came from;
 * "next pending" continues in that order.
 */
export default function AdminPropertyEditor({ propertyId, listContext = {}, heldIds = null, refreshToken = 0, onClose, onOpen, approveNow, onCompare }) {
  const { isAdmin, hasPermission } = useAdminPermissions()
  const canModerate = hasPermission(PERMISSIONS.PROPERTIES_MODERATE)
  const toast = useToast()

  const [listing, setListing] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [siblingsKey, setSiblingsKey] = useState(0)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [removeOpen, setRemoveOpen] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setLoadError(null)
    void getProperty(propertyId, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return
      if (result.error) {
        if (result.error.code !== 'ABORTED') setLoadError(result.error)
        return
      }
      setListing(result.data)
    })
    return () => controller.abort()
  }, [propertyId, reloadKey, refreshToken])

  const current = listing && listing.id === propertyId ? listing : null
  const label = current ? getPropertyDisplayLabel(current) || 'this listing' : 'this listing'
  const status = current && heldIds?.has(current.id) ? 'approved' : current?.status

  // Opens the pending listing that follows this one in the list's order, or
  // goes back to the list when there is none.
  const goNext = async () => {
    const next = await getNextPendingInList({ current: current || { id: propertyId }, sort: listContext.sort, filters: listContext.filters, search: listContext.search })
    if (next.error) {
      toast.error('The next pending listing could not be found', { description: next.error.message })
      setReloadKey((key) => key + 1)
      return
    }
    if (next.data) {
      onOpen?.(next.data)
      return
    }
    toast.info('No more pending listings', { description: 'That was the last one in this list.' })
    onClose?.()
  }

  const handleSaved = async (mode) => {
    if (mode === 'approve') {
      approveNow?.(current || { id: propertyId })
      await goNext()
      return
    }
    toast.success(`Saved ${label}`)
    if (mode === 'next') {
      await goNext()
      return
    }
    setReloadKey((key) => key + 1)
  }

  const rejectMutation = useAdminMutation((id, reason, note) => setPropertyStatus({ ids: [id], status: 'rejected', reason, note }), {
    successMessage: 'Listing rejected',
    invalidate: ['properties', 'duplicate-groups'],
  })
  const removeMutation = useAdminMutation((id, reason) => softDeleteProperty(id, reason), { successMessage: 'Listing removed', invalidate: ['properties', 'duplicate-groups'] })

  const renderActions = (formState) => (
    <EditorActionBar
      {...formState}
      canModerate={canModerate}
      status={status}
      hasListing={Boolean(current)}
      removed={Boolean(current?.deleted_at)}
      onReject={() => setRejectTarget(current)}
      onRemove={() => setRemoveOpen(true)}
    />
  )

  return (
    <div className="space-y-4" data-testid="admin-property-editor">
      <h2 className="sr-only">Edit listing {label}</h2>
      <div className="ui-card flex flex-wrap items-center gap-3 p-4">
        <Button variant="ghost" size="sm" icon={<FiArrowLeft />} onClick={onClose}>
          Back to list
        </Button>
        {current ? (
          <>
            <span className="ui-id-ticket" data-testid="editor-listing-id">{label}</span>
            <StatusPill status={status} data-testid="editor-status" />
            {current.deleted_at ? <Badge variant="neutral">Removed</Badge> : null}
            {current.isDuplicatePhone ? <Badge variant="danger">Duplicate phone ×{current.duplicateCount}</Badge> : null}
            <p className="text-sm text-muted" data-testid="editor-submitter">
              Submitted by <span className="font-medium text-ink">{submitterLabel(current)}</span>
              {current.submitted_by?.email && current.submitted_by?.name ? ` (${current.submitted_by.email})` : ''} · {formatDateTime(current.created_at)}
            </p>
          </>
        ) : loadError ? null : (
          <p className="text-sm text-muted" role="status">Loading listing…</p>
        )}
      </div>

      {loadError ? <InlineAlert variant="danger">The listing details could not be loaded. {loadError.message}</InlineAlert> : null}

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <EditPropertyForm
          key={`${propertyId}:${reloadKey}`}
          adminPanel={{ propertyId, canEdit: isAdmin, onSaved: handleSaved, onClose, renderActions }}
        />
        <aside className="xl:sticky xl:top-28">
          {current ? (
            <SamePhonePanel
              phoneKey={current.duplicatePhoneKey}
              phoneNumber={current.contact_number}
              excludeId={current.id}
              refreshKey={siblingsKey + refreshToken}
              heldIds={heldIds}
              canModerate={canModerate}
              onOpen={onOpen}
              onApprove={approveNow}
              onReject={setRejectTarget}
              onCompare={onCompare}
            />
          ) : null}
        </aside>
      </div>

      <ReasonDialog
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        decision="reject"
        title={`Reject ${rejectTarget ? getPropertyDisplayLabel(rejectTarget) || 'this listing' : 'this listing'}?`}
        description="The owner sees the listing as rejected with your reason. It stays hidden from the public site. Unsaved changes in the form are not saved."
        reasonRequired
        reasonHelp="Shown to the listing owner."
        reasonOptions={REJECT_REASONS}
        busy={rejectMutation.busy}
        error={rejectMutation.error}
        onConfirm={async ({ reason, note }) => {
          const target = rejectTarget
          const result = await rejectMutation.run(target.id, reason, note)
          if (result.error) return
          setRejectTarget(null)
          if (target.id === propertyId) await goNext()
          else setSiblingsKey((key) => key + 1)
        }}
      />

      <ReasonDialog
        open={removeOpen}
        onClose={() => setRemoveOpen(false)}
        decision="reject"
        title={`Remove ${label}?`}
        description="The listing is hidden everywhere and marked as removed. It is not deleted and can be audited later."
        reasonLabel="Reason for removal"
        reasonHelp="Recorded in the audit log."
        confirmLabel="Remove listing"
        showNote={false}
        busy={removeMutation.busy}
        error={removeMutation.error}
        onConfirm={async ({ reason }) => {
          const result = await removeMutation.run(propertyId, reason)
          if (result.error) return
          setRemoveOpen(false)
          await goNext()
        }}
      />
    </div>
  )
}
