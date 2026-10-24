'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { FiBriefcase, FiLock, FiRefreshCw, FiShield, FiSlash, FiUnlock, FiUsers, FiZap } from 'react-icons/fi'
import {
  adjustUserCredits,
  blacklistUser,
  getBlacklistReasons,
  listUsers,
  setEmployeeFlag,
  setUserActive,
  setUserRoles,
  unblacklistUser,
} from '../../services/admin/users'
import { getDashboardStats } from '../../services/admin/dashboard'
import { useAdminPermissions } from '../../contexts/AdminAccessContext'
import { ADMIN_ROLES, ADMIN_ROLE_LABELS, PERMISSIONS } from '../../lib/adminPermissions'
import { useShellHeader } from '../../components/panel/PanelShellContext'
import { useAdminList } from '../../components/admin-panel/hooks/useAdminList'
import { useAdminMutation } from '../../components/admin-panel/hooks/useAdminMutation'
import { useEntityParam } from '../../components/admin-panel/hooks/useEntityParam'
import Badge from '../../components/ui/Badge'
import Button from '../../components/ui/Button'
import ConfirmDialog from '../../components/ui/ConfirmDialog'
import DataTable from '../../components/ui/DataTable'
import Dialog from '../../components/ui/Dialog'
import EmptyState from '../../components/ui/EmptyState'
import FilterBar from '../../components/ui/FilterBar'
import FormDialog from '../../components/ui/FormDialog'
import InlineAlert from '../../components/ui/InlineAlert'
import KeyValueList from '../../components/ui/KeyValueList'
import Pagination from '../../components/ui/Pagination'
import StatCard from '../../components/ui/StatCard'
import StatusPill from '../../components/ui/StatusPill'

const formatDate = (value) => (value ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
const formatDateTime = (value) => (value ? new Date(value).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—')

const roleBadges = (user) => {
  const roles = user.roles?.length ? user.roles : user.is_admin ? ['super_admin'] : []
  return roles.map((role) => (
    <Badge key={role} variant="brand">
      {ADMIN_ROLE_LABELS[role] || role}
    </Badge>
  ))
}

const UserManagement = () => {
  const { hasPermission, roles: myRoles, isLegacyAdmin } = useAdminPermissions()
  const canModerate = hasPermission(PERMISSIONS.USERS_MODERATE)
  const canManageRoles = hasPermission(PERMISSIONS.USERS_MANAGE_ROLES) && (isLegacyAdmin || myRoles.includes('super_admin'))
  const canManageEmployee = hasPermission(PERMISSIONS.USERS_MANAGE_EMPLOYEE)
  const canAdjustCredits = hasPermission(PERMISSIONS.CREDITS_ADJUST)

  const list = useAdminList({ domain: 'users', fetcher: listUsers, initialFilters: { status: '', isAdmin: '', isEmployee: '' } })
  const [selectedId, setSelectedId] = useEntityParam('id')
  const [stats, setStats] = useState(null)
  const [blockTarget, setBlockTarget] = useState(null)
  const [blacklistTarget, setBlacklistTarget] = useState(null)
  const [unblacklistTarget, setUnblacklistTarget] = useState(null)
  const [creditsTarget, setCreditsTarget] = useState(null)
  const [rolesTarget, setRolesTarget] = useState(null)

  useEffect(() => {
    let active = true
    void getDashboardStats().then((result) => {
      if (active && result.data) setStats(result.data.metrics.users)
    })
    return () => {
      active = false
    }
  }, [list.totalCount])

  const activeMutation = useAdminMutation((id, isActive, reason) => setUserActive(id, isActive, reason), { successMessage: (result) => (result.data?.is_active ? 'User unblocked' : 'User blocked'), invalidate: ['users'] })
  const blacklistMutation = useAdminMutation((id, payload) => blacklistUser({ userId: id, ...payload }), { successMessage: 'User blacklisted', invalidate: ['users'] })
  const unblacklistMutation = useAdminMutation((id, note) => unblacklistUser(id, note), { successMessage: 'Removed from blacklist', invalidate: ['users'] })
  const employeeMutation = useAdminMutation((id, isEmployee) => setEmployeeFlag(id, isEmployee), { successMessage: (result) => (result.data?.is_employee ? 'Marked as employee' : 'Employee tag removed'), invalidate: ['users'] })
  const creditsMutation = useAdminMutation((id, payload) => adjustUserCredits({ userId: id, ...payload }), { successMessage: (result) => `Credits updated to ${result.data?.credits_after}`, invalidate: ['users'] })
  const rolesMutation = useAdminMutation((id, roles) => setUserRoles(id, roles), { successMessage: 'Roles updated', invalidate: ['users'] })

  const headerActions = useMemo(
    () => (
      <Button variant="secondary" icon={<FiRefreshCw />} onClick={() => list.refresh()} busy={list.isRefreshing} busyLabel="Refreshing…">
        Refresh
      </Button>
    ),
    [list]
  )
  useShellHeader({ actions: headerActions })

  const selected = list.items.find((user) => user.id === selectedId) || null

  const columns = useMemo(
    () => [
      {
        key: 'name',
        header: 'User',
        sortable: true,
        render: (user) => (
          <div className="flex items-center gap-3">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand" aria-hidden="true">
              {(user.name || user.email || '?').charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-ink">{user.name || 'Unnamed'}</p>
              <p className="truncate text-caption text-muted">{user.email || '—'}</p>
            </div>
          </div>
        ),
      },
      { key: 'phone', header: 'Phone', hideBelow: 'lg', render: (user) => user.phone || '—' },
      { key: 'status', header: 'Status', render: (user) => <StatusPill status={user.is_active === false ? 'blocked' : 'active'} /> },
      {
        key: 'roles',
        header: 'Roles',
        render: (user) => (
          <div className="flex flex-wrap gap-1">
            {roleBadges(user)}
            {user.is_employee ? <Badge variant="neutral" icon={<FiBriefcase />}>Employee</Badge> : null}
            {user.is_blacklisted ? <Badge variant="danger">Blacklisted</Badge> : null}
            {!user.is_admin && !user.roles?.length && !user.is_employee && !user.is_blacklisted ? <span className="text-caption text-muted">User</span> : null}
          </div>
        ),
      },
      { key: 'credits', header: 'Credits', sortable: true, align: 'right', render: (user) => user.credits ?? 0 },
      { key: 'created_at', header: 'Joined', sortable: true, hideBelow: 'lg', render: (user) => formatDate(user.created_at) },
    ],
    []
  )

  const rowActions = (user) => (
    <>
      <Button size="sm" variant="secondary" onClick={() => setSelectedId(user.id)}>
        Details
      </Button>
      {canModerate ? (
        <Button size="sm" variant="ghost" iconOnly aria-label={user.is_active === false ? `Unblock ${user.name || user.email}` : `Block ${user.name || user.email}`} onClick={() => setBlockTarget(user)}>
          {user.is_active === false ? <FiUnlock /> : <FiLock />}
        </Button>
      ) : null}
    </>
  )

  const chips = []
  if (list.filters.status) chips.push({ key: 'status', label: list.filters.status === 'active' ? 'Active only' : 'Blocked only', onRemove: () => list.setFilter('status', '') })
  if (list.filters.isAdmin) chips.push({ key: 'isAdmin', label: 'Admins only', onRemove: () => list.setFilter('isAdmin', '') })
  if (list.filters.isEmployee) chips.push({ key: 'isEmployee', label: 'Employees only', onRemove: () => list.setFilter('isEmployee', '') })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Users" value={stats?.total?.value} loading={!stats} error={stats?.total?.error} icon={<FiUsers />} />
        <StatCard label="Active" value={stats?.active?.value} loading={!stats} error={stats?.active?.error} icon={<FiUnlock />} />
        <StatCard label="Blocked" value={stats ? Math.max(0, (stats.total?.value ?? 0) - (stats.active?.value ?? 0)) : null} loading={!stats} icon={<FiLock />} />
        <StatCard label="Admins" value={stats?.admins?.value} loading={!stats} error={stats?.admins?.error} icon={<FiShield />} />
      </div>

      <InlineAlert variant="info">Employee is an internal tag only. It does not grant admin access; roles do.</InlineAlert>

      <FilterBar
        search={{ value: list.search, onChange: list.setSearch, label: 'Search users', placeholder: 'Name, email or phone…' }}
        filters={[
          { key: 'status', label: 'Status', type: 'select', value: list.filters.status, onChange: (value) => list.setFilter('status', value), options: [{ value: 'active', label: 'Active' }, { value: 'blocked', label: 'Blocked' }], placeholder: 'All' },
          { key: 'isAdmin', label: 'Admins', type: 'select', value: list.filters.isAdmin, onChange: (value) => list.setFilter('isAdmin', value), options: [{ value: 'true', label: 'Admins only' }], placeholder: 'Everyone' },
          { key: 'isEmployee', label: 'Employees', type: 'select', value: list.filters.isEmployee, onChange: (value) => list.setFilter('isEmployee', value), options: [{ value: 'true', label: 'Employees only' }], placeholder: 'Everyone' },
        ]}
        chips={chips}
        onClearAll={list.resetFilters}
        resultCount={list.status === 'loading' ? null : list.totalCount}
        resultLabel="users"
      />

      <DataTable
        caption="Registered users"
        columns={columns}
        rows={list.items}
        loading={list.isLoading}
        error={list.status === 'error' || list.status === 'permission-denied' ? list.error : null}
        onRetry={list.retry}
        empty={<EmptyState title="No users match" description="Try clearing the filters or search." />}
        rowActions={rowActions}
        sort={{ key: list.sort.column, direction: list.sort.dir }}
        onSortChange={(next) => list.setSort({ column: next.key, dir: next.direction })}
        getRowLabel={(user) => user.name || user.email || 'user'}
      />

      <Pagination page={list.page} pageSize={list.pageSize} total={list.totalCount} onPageChange={list.setPage} onPageSizeChange={list.setPageSize} />

      <Dialog open={Boolean(selected)} onClose={() => setSelectedId(null)} title={selected?.name || selected?.email || 'User'} size="lg" fullScreenOnMobile>
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={selected.is_active === false ? 'blocked' : 'active'} />
              {roleBadges(selected)}
              {selected.is_employee ? <Badge variant="neutral">Employee</Badge> : null}
              {selected.is_blacklisted ? <Badge variant="danger">Blacklisted</Badge> : null}
            </div>
            <KeyValueList
              columns={2}
              items={[
                { key: 'email', label: 'Email', value: selected.email },
                { key: 'phone', label: 'Phone', value: selected.phone },
                { key: 'credits', label: 'Credits', value: selected.credits ?? 0 },
                { key: 'provider', label: 'Sign-in', value: selected.provider },
                { key: 'joined', label: 'Joined', value: formatDate(selected.created_at) },
                { key: 'updated', label: 'Last updated', value: formatDateTime(selected.updated_at) },
              ]}
            />

            {selected.blacklist_history?.length ? (
              <div>
                <h3 className="text-sm font-semibold text-ink">Blacklist history</h3>
                <ul className="mt-2 space-y-2">
                  {selected.blacklist_history.map((entry) => (
                    <li key={entry.id} className="rounded-[var(--radius-card)] border border-line bg-canvas p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium text-ink">{entry.reason}</span>
                        <Badge variant={entry.lifted_at ? 'neutral' : 'danger'}>{entry.lifted_at ? `Lifted ${formatDate(entry.lifted_at)}` : entry.is_permanent ? 'Permanent' : `Until ${formatDate(entry.expires_at)}`}</Badge>
                      </div>
                      <p className="mt-1 text-caption text-muted">
                        Added {formatDateTime(entry.blacklisted_at)}
                        {entry.notes ? ` · ${entry.notes}` : ''}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2 border-t border-line pt-4">
              {canModerate ? (
                <Button variant={selected.is_active === false ? 'primary' : 'secondary'} icon={selected.is_active === false ? <FiUnlock /> : <FiLock />} onClick={() => setBlockTarget(selected)}>
                  {selected.is_active === false ? 'Unblock' : 'Block'}
                </Button>
              ) : null}
              {canModerate ? (
                selected.is_blacklisted ? (
                  <Button variant="secondary" icon={<FiSlash />} onClick={() => setUnblacklistTarget(selected)}>
                    Remove from blacklist
                  </Button>
                ) : (
                  <Button variant="danger-outline" icon={<FiSlash />} onClick={() => setBlacklistTarget(selected)}>
                    Blacklist
                  </Button>
                )
              ) : null}
              {canManageEmployee ? (
                <Button variant="secondary" icon={<FiBriefcase />} busy={employeeMutation.busy} onClick={() => void employeeMutation.run(selected.id, !selected.is_employee)}>
                  {selected.is_employee ? 'Remove employee tag' : 'Mark as employee'}
                </Button>
              ) : null}
              {canAdjustCredits ? (
                <Button variant="secondary" icon={<FiZap />} onClick={() => setCreditsTarget(selected)}>
                  Adjust credits
                </Button>
              ) : null}
              {canManageRoles ? (
                <Button variant="secondary" icon={<FiShield />} onClick={() => setRolesTarget(selected)}>
                  Roles
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Dialog>

      <ConfirmDialog
        open={Boolean(blockTarget)}
        onCancel={() => setBlockTarget(null)}
        onConfirm={async () => {
          const target = blockTarget
          setBlockTarget(null)
          await activeMutation.run(target.id, target.is_active === false, null)
        }}
        title={blockTarget?.is_active === false ? 'Unblock this user?' : 'Block this user?'}
        description={blockTarget?.is_active === false ? 'They will be able to sign in and use the site again.' : 'Blocked users cannot use their account. You can unblock them later.'}
        confirmLabel={blockTarget?.is_active === false ? 'Unblock' : 'Block'}
        tone={blockTarget?.is_active === false ? 'primary' : 'danger'}
        busy={activeMutation.busy}
        busyLabel="Updating…"
      />

      <BlacklistDialog user={blacklistTarget} onClose={() => setBlacklistTarget(null)} mutation={blacklistMutation} />

      <ConfirmDialog
        open={Boolean(unblacklistTarget)}
        onCancel={() => setUnblacklistTarget(null)}
        onConfirm={async () => {
          const target = unblacklistTarget
          setUnblacklistTarget(null)
          await unblacklistMutation.run(target.id, 'Lifted from the admin panel')
        }}
        title="Remove from blacklist?"
        description="The account is reactivated. The blacklist entry stays in the history."
        confirmLabel="Remove from blacklist"
        tone="primary"
        busy={unblacklistMutation.busy}
        busyLabel="Updating…"
      />

      <CreditsDialog user={creditsTarget} onClose={() => setCreditsTarget(null)} mutation={creditsMutation} />
      <RolesDialog user={rolesTarget} onClose={() => setRolesTarget(null)} mutation={rolesMutation} />
    </div>
  )
}

const BlacklistDialog = ({ user, onClose, mutation }) => {
  const [draft, setDraft] = useState({ reason: '', notes: '', permanent: true, expiresAt: '' })
  const [key, setKey] = useState(null)
  if (user && key !== user.id) {
    setKey(user.id)
    setDraft({ reason: '', notes: '', permanent: true, expiresAt: '' })
  }
  const reasons = getBlacklistReasons()
  return (
    <FormDialog
      open={Boolean(user)}
      onClose={onClose}
      title={`Blacklist ${user?.name || user?.email || 'user'}`}
      description="The account is deactivated and the reason recorded with your name."
      submitLabel="Blacklist"
      submitVariant="danger"
      busy={mutation.busy}
      error={mutation.error}
      submitDisabled={!draft.reason || (!draft.permanent && !draft.expiresAt)}
      onSubmit={async () => {
        const result = await mutation.run(user.id, { reason: draft.reason, notes: draft.notes.trim() || null, isPermanent: draft.permanent, expiresAt: draft.permanent ? null : new Date(`${draft.expiresAt}T23:59:59`).toISOString() })
        if (!result.error) onClose()
      }}
    >
      <div>
        <label className="ui-label" htmlFor="blacklist-reason">Reason<span className="ui-required" aria-hidden="true">*</span></label>
        <select id="blacklist-reason" className="ui-field" required value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })}>
          <option value="">Choose a reason…</option>
          {reasons.map((reason) => (
            <option key={reason.value} value={reason.value}>{reason.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="ui-label" htmlFor="blacklist-notes">Notes</label>
        <textarea id="blacklist-notes" className="ui-field" rows={3} value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
        <p className="ui-help">Only visible to admins.</p>
      </div>
      <fieldset className="space-y-2">
        <legend className="ui-label">Duration</legend>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="radio" name="duration" className="accent-brand" checked={draft.permanent} onChange={() => setDraft({ ...draft, permanent: true })} /> Permanent
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="radio" name="duration" className="accent-brand" checked={!draft.permanent} onChange={() => setDraft({ ...draft, permanent: false })} /> Until a date
        </label>
        {!draft.permanent ? (
          <div>
            <label className="ui-label" htmlFor="blacklist-expires">Expires on</label>
            <input id="blacklist-expires" type="date" className="ui-field" required value={draft.expiresAt} min={new Date().toISOString().slice(0, 10)} onChange={(event) => setDraft({ ...draft, expiresAt: event.target.value })} />
          </div>
        ) : null}
      </fieldset>
    </FormDialog>
  )
}

const CreditsDialog = ({ user, onClose, mutation }) => {
  const [draft, setDraft] = useState({ direction: 'add', amount: '', reason: '' })
  const [key, setKey] = useState(null)
  if (user && key !== user.id) {
    setKey(user.id)
    setDraft({ direction: 'add', amount: '', reason: '' })
  }
  const amount = Number(draft.amount) || 0
  const delta = draft.direction === 'add' ? amount : -amount
  const resulting = (user?.credits ?? 0) + delta
  return (
    <FormDialog
      open={Boolean(user)}
      onClose={onClose}
      title={`Adjust credits for ${user?.name || user?.email || 'user'}`}
      description="Every adjustment is written to the credit ledger with your name and reason."
      submitLabel="Apply adjustment"
      busy={mutation.busy}
      error={mutation.error}
      submitDisabled={amount <= 0 || draft.reason.trim().length < 3 || resulting < 0}
      onSubmit={async () => {
        const result = await mutation.run(user.id, { delta, reason: draft.reason.trim(), expectedBalance: user.credits ?? 0 })
        if (!result.error) onClose()
      }}
    >
      <fieldset className="flex gap-4">
        <legend className="ui-label">Direction</legend>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="radio" name="direction" className="accent-brand" checked={draft.direction === 'add'} onChange={() => setDraft({ ...draft, direction: 'add' })} /> Add
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="radio" name="direction" className="accent-brand" checked={draft.direction === 'remove'} onChange={() => setDraft({ ...draft, direction: 'remove' })} /> Remove
        </label>
      </fieldset>
      <div>
        <label className="ui-label" htmlFor="credits-amount">Amount<span className="ui-required" aria-hidden="true">*</span></label>
        <input id="credits-amount" type="number" min="1" step="1" className="ui-field" required value={draft.amount} onChange={(event) => setDraft({ ...draft, amount: event.target.value })} aria-describedby="credits-amount-help" />
        <p id="credits-amount-help" className={`ui-help ${resulting < 0 ? 'text-danger' : ''}`}>
          Current balance {user?.credits ?? 0} → {resulting < 0 ? 'cannot go below 0' : `${resulting} after this change`}
        </p>
      </div>
      <div>
        <label className="ui-label" htmlFor="credits-reason">Reason<span className="ui-required" aria-hidden="true">*</span></label>
        <textarea id="credits-reason" className="ui-field" rows={2} required value={draft.reason} onChange={(event) => setDraft({ ...draft, reason: event.target.value })} />
      </div>
    </FormDialog>
  )
}

const RolesDialog = ({ user, onClose, mutation }) => {
  const [roles, setRoles] = useState([])
  const [key, setKey] = useState(null)
  if (user && key !== user.id) {
    setKey(user.id)
    setRoles(user.roles?.length ? user.roles : user.is_admin ? ['super_admin'] : [])
  }
  const toggle = (role) => setRoles((current) => (current.includes(role) ? current.filter((entry) => entry !== role) : [...current, role]))
  return (
    <FormDialog
      open={Boolean(user)}
      onClose={onClose}
      title={`Admin roles for ${user?.name || user?.email || 'user'}`}
      description="Roles decide which admin areas and actions this user can access. Removing every role revokes admin access."
      submitLabel="Save roles"
      busy={mutation.busy}
      error={mutation.error}
      onSubmit={async () => {
        const result = await mutation.run(user.id, roles)
        if (!result.error) onClose()
      }}
    >
      <fieldset className="space-y-2">
        <legend className="ui-label">Roles</legend>
        {ADMIN_ROLES.map((role) => (
          <label key={role} className="flex items-center gap-3 rounded-[var(--radius-card)] border border-line p-3 text-sm text-ink">
            <input type="checkbox" className="h-5 w-5 accent-brand" checked={roles.includes(role)} onChange={() => toggle(role)} />
            <span className="font-medium">{ADMIN_ROLE_LABELS[role]}</span>
          </label>
        ))}
      </fieldset>
    </FormDialog>
  )
}

export default UserManagement
