'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { FiRefreshCw, FiShield, FiTrash2, FiUserPlus } from 'react-icons/fi'
import { getSiteSettings, listAdminMemberships, updateSiteSettings } from '../../../services/admin/settings'
import { listUsers, setUserRoles } from '../../../services/admin/users'
import { invalidateAdminSnapshots } from '../../../services/admin/adminCache'
import { ADMIN_ROLES, ADMIN_ROLE_LABELS, PERMISSIONS, formatRoleLabels } from '../../../lib/adminPermissions'
import { useAdminPermissions } from '../../../contexts/AdminAccessContext'
import { useShellHeader } from '../../panel/PanelShellContext'
import { useAdminMutation } from '../hooks/useAdminMutation'
import { useDebouncedValue } from '../hooks/useDebouncedValue'
import Badge from '../../ui/Badge'
import Button from '../../ui/Button'
import ConfirmDialog from '../../ui/ConfirmDialog'
import DataTable from '../../ui/DataTable'
import EmptyState from '../../ui/EmptyState'
import FormDialog from '../../ui/FormDialog'
import InlineAlert from '../../ui/InlineAlert'
import Skeleton from '../../ui/Skeleton'
import { useToast } from '../../ui/ToastProvider'

const SITE_THEME_EVENT = 'site-theme-updated'

const Switch = ({ id, checked, onChange, label, description, busy = false, tone = 'brand' }) => (
  <div className="flex items-start justify-between gap-4 py-3">
    <div className="min-w-0">
      <label id={`${id}-label`} htmlFor={id} className="block text-sm font-semibold text-ink">
        {label}
      </label>
      {description ? <p className="mt-0.5 text-caption text-muted">{description}</p> : null}
    </div>
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={`${id}-label`}
      aria-busy={busy || undefined}
      disabled={busy}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-line transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
        checked ? (tone === 'danger' ? 'bg-danger' : 'bg-brand') : 'bg-canvas'
      } ${busy ? 'opacity-60' : ''}`}
    >
      <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'translate-x-6' : 'translate-x-1'}`} aria-hidden="true" />
    </button>
  </div>
)

const AdminSettingsSection = () => {
  const { hasPermission, refresh: refreshAccess } = useAdminPermissions()
  const toast = useToast()
  const canManageRoles = hasPermission(PERMISSIONS.USERS_MANAGE_ROLES)

  const [settings, setSettings] = useState(null)
  const [settingsError, setSettingsError] = useState(null)
  const [memberships, setMemberships] = useState(null)
  const [membershipsError, setMembershipsError] = useState(null)
  const [pendingSwitch, setPendingSwitch] = useState(null) // { key, value }
  const [rolesTarget, setRolesTarget] = useState(null)
  const [addingAdmin, setAddingAdmin] = useState(false)

  const loadSettings = useCallback(async () => {
    const result = await getSiteSettings()
    if (result.error) setSettingsError(result.error)
    else {
      setSettingsError(null)
      setSettings(result.data)
    }
  }, [])

  const loadMemberships = useCallback(async () => {
    const result = await listAdminMemberships()
    if (result.error) setMembershipsError(result.error)
    else {
      setMembershipsError(null)
      setMemberships(result.data)
    }
  }, [])

  useEffect(() => {
    void loadSettings()
    void loadMemberships()
  }, [loadSettings, loadMemberships])

  const settingsMutation = useAdminMutation((patch) => updateSiteSettings(patch), {
    successMessage: 'Settings saved',
    invalidate: ['settings'],
    onSuccess: (result, patch) => {
      setSettings(result.data)
      if (patch.site_theme && typeof window !== 'undefined') {
        window.localStorage?.setItem('newtolet:site-theme', JSON.stringify(patch.site_theme))
        window.dispatchEvent(new CustomEvent(SITE_THEME_EVENT, { detail: { theme: patch.site_theme } }))
      }
    },
  })

  const rolesMutation = useAdminMutation((userId, roles) => setUserRoles(userId, roles), {
    successMessage: 'Roles updated',
    invalidate: ['users'],
    onSuccess: () => {
      void loadMemberships()
      refreshAccess?.()
    },
  })

  const refreshAction = useMemo(
    () => (
      <Button
        variant="secondary"
        icon={<FiRefreshCw />}
        onClick={() => {
          void loadSettings()
          void loadMemberships()
        }}
      >
        Refresh
      </Button>
    ),
    [loadSettings, loadMemberships]
  )
  useShellHeader({ actions: refreshAction })

  const requestSwitch = (key, value) => {
    // Turning maintenance mode on or auto-approve on are the risky directions; confirm them.
    if ((key === 'maintenance_mode' && value) || (key === 'auto_approve_properties' && value)) {
      setPendingSwitch({ key, value })
      return
    }
    void settingsMutation.run({ [key]: value })
  }

  const membershipColumns = useMemo(
    () => [
      {
        key: 'user',
        header: 'Admin',
        render: (row) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{row.user?.name || row.user?.email || row.userId}</p>
            <p className="truncate text-caption text-muted">{row.user?.email || row.user?.phone || ''}</p>
          </div>
        ),
      },
      {
        key: 'roles',
        header: 'Roles',
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            {row.roles.map((role) => (
              <Badge key={role} variant={role === 'super_admin' ? 'brand' : 'neutral'}>
                {ADMIN_ROLE_LABELS[role] || role}
              </Badge>
            ))}
          </div>
        ),
      },
      {
        key: 'status',
        header: 'Account',
        hideBelow: 'md',
        render: (row) => (row.user?.is_active === false ? <Badge variant="danger">Blocked</Badge> : <Badge variant="success">Active</Badge>),
      },
      { key: 'source', header: 'Granted', hideBelow: 'lg', render: (row) => <span className="text-sm text-muted">{row.source === 'backfill' ? 'Legacy flag (backfilled)' : 'Manually'}</span> },
    ],
    []
  )

  return (
    <div className="space-y-6">
      <section aria-labelledby="platform-switches" className="ui-card space-y-1 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 id="platform-switches" className="text-base font-semibold text-ink">
            Platform switches
          </h2>
          {settings?.maintenance_mode ? <Badge variant="danger">Maintenance on</Badge> : null}
        </div>
        {settingsError ? (
          <InlineAlert variant={settingsError.permissionDenied ? 'permission' : 'danger'} title="Settings could not be loaded" action={<Button size="sm" onClick={() => void loadSettings()}>Retry</Button>}>
            {settingsError.message}
          </InlineAlert>
        ) : !settings ? (
          <div className="space-y-3 py-2" aria-hidden="true">
            <Skeleton width="60%" />
            <Skeleton width="40%" />
            <Skeleton width="50%" />
          </div>
        ) : (
          <div className="divide-y divide-line">
            <Switch
              id="switch-maintenance"
              label="Maintenance mode"
              description="Shows the maintenance notice to visitors. Admins can still sign in."
              checked={Boolean(settings.maintenance_mode)}
              busy={settingsMutation.busy}
              tone="danger"
              onChange={(value) => requestSwitch('maintenance_mode', value)}
            />
            <Switch
              id="switch-auto-approve"
              label="Auto-approve new listings"
              description="New listings go live without review. Leave off to keep the moderation queue."
              checked={Boolean(settings.auto_approve_properties)}
              busy={settingsMutation.busy}
              onChange={(value) => requestSwitch('auto_approve_properties', value)}
            />
            <fieldset className="py-3">
              <legend className="text-sm font-semibold text-ink">Site theme</legend>
              <p className="mt-0.5 text-caption text-muted">Default colour scheme for visitors who have not chosen one.</p>
              <div className="mt-2 flex flex-wrap gap-3">
                {['light', 'dark'].map((theme) => (
                  <label key={theme} className={`ui-chip cursor-pointer capitalize ${settings.site_theme === theme ? 'ring-2 ring-brand' : ''}`}>
                    <input
                      type="radio"
                      name="site-theme"
                      value={theme}
                      className="mr-2"
                      checked={settings.site_theme === theme}
                      disabled={settingsMutation.busy}
                      onChange={() => void settingsMutation.run({ site_theme: theme })}
                    />
                    {theme}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </section>

      <section aria-labelledby="admin-roles" className="ui-card space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="admin-roles" className="flex items-center gap-2 text-base font-semibold text-ink">
              <FiShield aria-hidden="true" /> Admin roles
            </h2>
            <p className="text-caption text-muted">Who can open this panel and what each person may do. Only super admins change roles.</p>
          </div>
          {canManageRoles ? (
            <Button variant="primary" icon={<FiUserPlus />} onClick={() => setAddingAdmin(true)}>
              Add admin
            </Button>
          ) : null}
        </div>
        <DataTable
          caption="Admin memberships"
          columns={membershipColumns}
          rows={memberships || []}
          rowKey="userId"
          loading={!memberships && !membershipsError}
          error={membershipsError}
          onRetry={() => void loadMemberships()}
          empty={<EmptyState title="No admin memberships" description="Legacy admins are backfilled when the migration runs." />}
          rowActions={canManageRoles ? (row) => <Button size="sm" variant="secondary" onClick={() => setRolesTarget(row)}>Edit roles</Button> : null}
          getRowLabel={(row) => row.user?.name || row.user?.email || row.userId}
          density="compact"
        />
      </section>

      <section aria-labelledby="caches" className="ui-card space-y-3 p-5">
        <h2 id="caches" className="text-base font-semibold text-ink">
          Caches
        </h2>
        <p className="text-caption text-muted">Admin lists keep a short-lived snapshot in this browser so pages paint instantly. Clear it if a list looks stale.</p>
        <Button
          variant="secondary"
          icon={<FiTrash2 />}
          onClick={() => {
            invalidateAdminSnapshots()
            toast.success('Admin cache cleared', { description: 'Lists will refetch on their next visit.' })
          }}
        >
          Clear admin cache
        </Button>
      </section>

      <ConfirmDialog
        open={Boolean(pendingSwitch)}
        onCancel={() => setPendingSwitch(null)}
        onConfirm={async () => {
          const next = pendingSwitch
          setPendingSwitch(null)
          await settingsMutation.run({ [next.key]: next.value })
        }}
        title={pendingSwitch?.key === 'maintenance_mode' ? 'Turn on maintenance mode?' : 'Turn on auto-approve?'}
        description={
          pendingSwitch?.key === 'maintenance_mode'
            ? 'Visitors will see the maintenance notice instead of the site until you turn this off.'
            : 'Every new listing will be published immediately without moderation. Duplicate and spam listings will reach visitors.'
        }
        confirmLabel="Turn on"
        tone={pendingSwitch?.key === 'maintenance_mode' ? 'danger' : 'brand'}
        busy={settingsMutation.busy}
        busyLabel="Saving…"
      />

      <RolesDialog
        target={rolesTarget}
        onClose={() => setRolesTarget(null)}
        mutation={rolesMutation}
      />

      <AddAdminDialog open={addingAdmin} onClose={() => setAddingAdmin(false)} mutation={rolesMutation} existingIds={new Set((memberships || []).map((row) => row.userId))} />
    </div>
  )
}

const RoleCheckboxes = ({ roles, onToggle, idPrefix }) => (
  <fieldset className="space-y-2">
    <legend className="ui-label">Roles</legend>
    {ADMIN_ROLES.map((role) => (
      <label key={role} htmlFor={`${idPrefix}-${role}`} className="flex items-start gap-3 rounded-[var(--radius-card)] border border-line px-3 py-2 text-sm text-ink">
        <input id={`${idPrefix}-${role}`} type="checkbox" className="mt-0.5" checked={roles.includes(role)} onChange={() => onToggle(role)} />
        <span>
          <span className="font-medium">{ADMIN_ROLE_LABELS[role]}</span>
          <span className="block text-caption text-muted">{ROLE_HELP[role]}</span>
        </span>
      </label>
    ))}
  </fieldset>
)

const ROLE_HELP = {
  super_admin: 'Everything, including roles and platform settings.',
  moderator: 'Listings, users, feedback, orders and inquiries.',
  finance: 'Payments, refunds, credits and pricing.',
  support: 'Orders, inquiries, feedback and read-only users.',
  content_manager: 'Homepage content and featured listings.',
}

const RolesDialog = ({ target, onClose, mutation }) => {
  const [roles, setRoles] = useState([])
  const [key, setKey] = useState(null)
  if (target && key !== target.userId) {
    setKey(target.userId)
    setRoles(target.roles)
  }
  const toggle = (role) => setRoles((current) => (current.includes(role) ? current.filter((entry) => entry !== role) : [...current, role]))
  return (
    <FormDialog
      open={Boolean(target)}
      onClose={onClose}
      title={target ? `Roles for ${target.user?.name || target.user?.email || 'admin'}` : ''}
      description="Removing every role revokes panel access. The last super admin cannot be removed."
      submitLabel="Save roles"
      busy={mutation.busy}
      error={mutation.error}
      onSubmit={async () => {
        const result = await mutation.run(target.userId, roles)
        if (!result.error) onClose()
      }}
    >
      <RoleCheckboxes roles={roles} onToggle={toggle} idPrefix="edit-role" />
      <p className="text-caption text-muted">Current: {target?.roles?.length ? formatRoleLabels(target.roles) : 'none'}</p>
    </FormDialog>
  )
}

const AddAdminDialog = ({ open, onClose, mutation, existingIds }) => {
  const [search, setSearch] = useState('')
  const debounced = useDebouncedValue(search, 300)
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState(null)
  const [roles, setRoles] = useState(['moderator'])

  useEffect(() => {
    if (!open || debounced.trim().length < 2) {
      setResults([])
      return undefined
    }
    const controller = new AbortController()
    setSearching(true)
    void listUsers({ search: debounced.trim(), pageSize: 6 }, { signal: controller.signal }).then((result) => {
      if (controller.signal.aborted) return
      setSearching(false)
      setResults(result.error ? [] : result.data || [])
    })
    return () => controller.abort()
  }, [debounced, open])

  const reset = () => {
    setSearch('')
    setResults([])
    setPicked(null)
    setRoles(['moderator'])
  }

  return (
    <FormDialog
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Add an admin"
      description="Find an existing account and choose what they may do. They get access on their next page load."
      submitLabel="Grant roles"
      submitDisabled={!picked || roles.length === 0}
      busy={mutation.busy}
      error={mutation.error}
      onSubmit={async () => {
        const result = await mutation.run(picked.id, roles)
        if (!result.error) {
          reset()
          onClose()
        }
      }}
    >
      <div>
        <label className="ui-label" htmlFor="add-admin-search">
          Find user
        </label>
        <input id="add-admin-search" type="search" className="ui-field" placeholder="Name, email or phone" value={search} onChange={(event) => setSearch(event.target.value)} autoComplete="off" />
        <p className="ui-help">{searching ? 'Searching…' : 'Type at least two characters.'}</p>
      </div>
      {results.length ? (
        <ul className="divide-y divide-line rounded-[var(--radius-card)] border border-line" aria-label="Matching users">
          {results.map((user) => (
            <li key={user.id}>
              <button
                type="button"
                className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-canvas ${picked?.id === user.id ? 'bg-brand-soft' : ''}`}
                aria-pressed={picked?.id === user.id}
                onClick={() => setPicked(user)}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-ink">{user.name || user.email}</span>
                  <span className="block truncate text-caption text-muted">{user.email || user.phone}</span>
                </span>
                {existingIds.has(user.id) ? <Badge variant="neutral">Already admin</Badge> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {picked ? (
        <>
          <p className="text-sm text-ink">
            Selected: <span className="font-semibold">{picked.name || picked.email}</span>
          </p>
          <RoleCheckboxes roles={roles} onToggle={(role) => setRoles((current) => (current.includes(role) ? current.filter((entry) => entry !== role) : [...current, role]))} idPrefix="add-role" />
        </>
      ) : null}
    </FormDialog>
  )
}

export default AdminSettingsSection
