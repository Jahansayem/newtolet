'use client'

import React, { useEffect, useMemo, useState } from 'react'
import {
  BiCreditCard,
} from 'react-icons/bi'
import { FaSave } from 'react-icons/fa'
import { MdAdd, MdSettings } from 'react-icons/md'
import {
  addCreditPackage,
  deleteCreditPackage,
  getAllUsersWithCredits,
  getCreditCosts,
  getCreditPackages,
  getSiteTheme,
  saveCreditCosts,
  saveSiteTheme,
  togglePackageStatus,
  updateCreditPackage,
  updateUserCredits,
} from '../../../services/adminService'
import Dialog from '../../ui/Dialog'
import ConfirmDialog from '../../ui/ConfirmDialog'

const SITE_THEME_EVENT = 'site-theme-updated'

const emptyPackage = {
  name: '',
  credits: 100,
  price: 500,
  discount: 0,
  popular: false,
}

// Accessible modal (focus trap, Escape, focus return) via the shared Dialog.
const ModalShell = ({ title, onClose, children }) => (
  <Dialog open onClose={onClose} title={title} size="sm">
    {children}
  </Dialog>
)

const AdminPricingSection = () => {
  const [loading, setLoading] = useState(true)
  const [savingSiteTheme, setSavingSiteTheme] = useState(false)
  const [creditPackages, setCreditPackages] = useState([])
  const [creditCosts, setCreditCosts] = useState({})
  const [siteTheme, setSiteTheme] = useState('light')
  const [usersWithCredits, setUsersWithCredits] = useState([])
  const [message, setMessage] = useState({ type: '', text: '' })
  const [showAddPackageModal, setShowAddPackageModal] = useState(false)
  const [showEditPackageModal, setShowEditPackageModal] = useState(false)
  const [showCreditModal, setShowCreditModal] = useState(false)
  const [editingPackage, setEditingPackage] = useState(null)
  const [newPackage, setNewPackage] = useState(emptyPackage)
  const [selectedUserForCredit, setSelectedUserForCredit] = useState(null)
  const [creditAmount, setCreditAmount] = useState(0)
  const [creditAction, setCreditAction] = useState('add')
  const [deletePackageTarget, setDeletePackageTarget] = useState(null)
  const [deletingPackage, setDeletingPackage] = useState(false)

  const loadPricingData = async () => {
    setLoading(true)

    try {
      const [packages, costs, usersResult, resolvedTheme] = await Promise.all([
        getCreditPackages(),
        getCreditCosts(),
        getAllUsersWithCredits(),
        getSiteTheme(),
      ])

      setCreditPackages(packages || [])
      setCreditCosts(costs || {})
      setUsersWithCredits(usersResult?.data || [])
      setSiteTheme(resolvedTheme || 'light')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadPricingData()
  }, [])

  const showMessage = (type, text) => {
    setMessage({ type, text })
    window.setTimeout(() => setMessage({ type: '', text: '' }), 3000)
  }

  const handleUnlockCostChange = (value) => {
    const sharedUnlockCost = Number.parseInt(value, 10) || 0
    setCreditCosts({
      property_listing: sharedUnlockCost,
      contact_view: sharedUnlockCost,
      photo_view: sharedUnlockCost,
    })
  }

  const handleSaveCreditCosts = async () => {
    const { error } = await saveCreditCosts(creditCosts)

    if (error) {
      showMessage('error', 'Failed to save credit costs')
      return
    }

    showMessage('success', 'Credit costs saved successfully')
    await loadPricingData()
  }

  const handleSaveSiteTheme = async () => {
    setSavingSiteTheme(true)
    const { error, theme } = await saveSiteTheme(siteTheme)

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(SITE_THEME_EVENT, { detail: { theme } }))
    }

    setSavingSiteTheme(false)

    if (error) {
      showMessage('error', 'Failed to save site theme')
      return
    }

    setSiteTheme(theme)
    showMessage('success', `Site theme switched to ${theme}`)
  }

  const handleAddPackage = async () => {
    if (!newPackage.name || newPackage.credits <= 0 || newPackage.price <= 0) {
      showMessage('error', 'Please fill all required fields')
      return
    }

    const { error } = await addCreditPackage(newPackage)
    if (error) {
      showMessage('error', 'Failed to add package')
      return
    }

    setShowAddPackageModal(false)
    setNewPackage(emptyPackage)
    showMessage('success', 'Package added successfully')
    await loadPricingData()
  }

  const handleUpdatePackage = async () => {
    if (!editingPackage?.name || editingPackage.credits <= 0 || editingPackage.price <= 0) {
      showMessage('error', 'Please fill all required fields')
      return
    }

    const { error } = await updateCreditPackage(editingPackage.id, editingPackage)
    if (error) {
      showMessage('error', 'Failed to update package')
      return
    }

    setShowEditPackageModal(false)
    setEditingPackage(null)
    showMessage('success', 'Package updated successfully')
    await loadPricingData()
  }

  // Opens the confirmation dialog; the actual delete runs from confirmDeletePackage.
  const handleDeletePackage = (packageId) => {
    const target = creditPackages.find((pkg) => pkg.id === packageId) || { id: packageId }
    setDeletePackageTarget(target)
  }

  const confirmDeletePackage = async () => {
    if (!deletePackageTarget) return
    setDeletingPackage(true)
    const { error } = await deleteCreditPackage(deletePackageTarget.id)
    setDeletingPackage(false)
    setDeletePackageTarget(null)
    if (error) {
      showMessage('error', error.message || 'Failed to delete package')
      return
    }

    showMessage('success', 'Package deleted successfully')
    await loadPricingData()
  }

  const handleTogglePackage = async (packageId) => {
    const { error } = await togglePackageStatus(packageId)
    if (error) {
      showMessage('error', 'Failed to toggle package status')
      return
    }

    showMessage('success', 'Package status updated')
    await loadPricingData()
  }

  const handleUpdateUserCredits = async () => {
    if (!selectedUserForCredit || creditAmount <= 0) {
      showMessage('error', 'Please select a user and enter a valid amount')
      return
    }

    const { error } = await updateUserCredits(selectedUserForCredit.id, creditAmount, creditAction)
    if (error) {
      showMessage('error', 'Failed to update user credits')
      return
    }

    setShowCreditModal(false)
    setSelectedUserForCredit(null)
    setCreditAmount(0)
    showMessage('success', 'User credits updated successfully')
    await loadPricingData()
  }

  const calculateFinalPrice = (pkg) => {
    const discount = (pkg.price * pkg.discount) / 100
    return pkg.price - discount
  }

  const topUsers = useMemo(() => usersWithCredits.slice(0, 8), [usersWithCredits])

  return (
    <div className="space-y-6">
      {message.text ? (
        <div
          className={`rounded-[24px] border px-4 py-3 text-sm font-medium ${
            message.type === 'success'
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="rounded-[var(--radius-panel)] bg-ink p-6 text-white shadow-card lg:col-span-2">
          <h2 className="text-2xl font-bold">Credit Pricing Overview</h2>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-sm text-blue-100">Total Packages</p>
              <p className="mt-2 text-3xl font-bold">{creditPackages.length}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-sm text-blue-100">Active Packages</p>
              <p className="mt-2 text-3xl font-bold">
                {creditPackages.filter((pkg) => pkg.is_active !== false).length}
              </p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-sm text-blue-100">Shared Unlock Cost</p>
              <p className="mt-2 text-3xl font-bold">{creditCosts.contact_view || 20}</p>
            </div>
            <div className="rounded-2xl bg-white/10 p-4">
              <p className="text-sm text-blue-100">Theme</p>
              <p className="mt-2 text-3xl font-bold capitalize">{siteTheme}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
          <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <MdSettings className="text-brand" />
            Unlock Cost Settings
          </h3>
          <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
            <input
              type="number"
              value={creditCosts.contact_view || 20}
              onChange={(event) => handleUnlockCostChange(event.target.value)}
              min="0"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand"
            />
            <div className="rounded-[var(--radius-card)] border border-dashed border-brand/30 bg-brand-soft px-4 py-3 text-sm text-ink">
              Shared with contact unlock, photo unlock, and legacy listing cost fields.
            </div>
            <button
              type="button"
              onClick={handleSaveCreditCosts}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <FaSave />
              Save
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto]">
            <select
              value={siteTheme}
              onChange={(event) => setSiteTheme(event.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-brand"
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
            <button
              type="button"
              onClick={handleSaveSiteTheme}
              disabled={savingSiteTheme}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover disabled:opacity-60"
            >
              <FaSave />
              {savingSiteTheme ? 'Saving...' : 'Save Theme'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="flex items-center gap-2 text-lg font-semibold text-slate-900">
              <BiCreditCard className="text-brand" />
              Credit Packages
            </h3>
            <p className="mt-1 text-sm text-slate-500">Manage packages available on the buy credits page.</p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddPackageModal(true)}
            className="inline-flex items-center gap-2 rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover"
          >
            <MdAdd />
            Add Package
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-slate-500">Loading packages...</div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {creditPackages.map((pkg) => (
              <div
                key={pkg.id}
                className={`relative rounded-[28px] border p-5 shadow-sm ${
                  pkg.is_active !== false
                    ? pkg.popular
                      ? 'border-brand/30 bg-brand-soft'
                      : 'border-slate-200 bg-white'
                    : 'border-slate-200 bg-slate-100 opacity-70'
                }`}
              >
                {pkg.popular ? (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand px-3 py-1 text-xs font-bold text-white">
                    Popular
                  </span>
                ) : null}
                <p className="text-lg font-semibold text-slate-900">{pkg.name}</p>
                <p className="mt-3 text-3xl font-bold text-brand">{pkg.credits}</p>
                <p className="text-sm text-slate-500">credits</p>
                <div className="mt-4 space-y-2 text-sm">
                  <p className="font-semibold text-slate-900">BDT {calculateFinalPrice(pkg)}</p>
                  {pkg.discount > 0 ? <p className="text-slate-500 line-through">BDT {pkg.price}</p> : null}
                  <p className="text-slate-500">{pkg.discount || 0}% discount</p>
                  <p className="text-slate-500">{pkg.is_active === false ? 'Inactive' : 'Active'}</p>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingPackage(pkg)
                      setShowEditPackageModal(true)
                    }}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTogglePackage(pkg.id)}
                    className="rounded-2xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    {pkg.is_active === false ? 'Enable' : 'Disable'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePackage(pkg.id)}
                    className="col-span-2 rounded-2xl border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Manual User Credit Adjustment</h3>
            <p className="mt-1 text-sm text-slate-500">Add, subtract, or set credits for users directly.</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {topUsers.map((user) => (
            <div key={user.id} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">{user.name || 'Unknown user'}</p>
              <p className="mt-1 text-xs text-slate-500">{user.email}</p>
              <p className="mt-3 text-2xl font-bold text-brand">{user.credits || 0}</p>
              <p className="text-xs text-slate-500">current credits</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedUserForCredit(user)
                  setShowCreditModal(true)
                }}
                className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
              >
                Adjust Credits
              </button>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deletePackageTarget)}
        onCancel={() => setDeletePackageTarget(null)}
        onConfirm={confirmDeletePackage}
        title="Delete this credit package?"
        description={`"${deletePackageTarget?.name || deletePackageTarget?.package_name || 'This package'}" will no longer be offered. Past purchases keep their records.`}
        confirmLabel="Delete package"
        busy={deletingPackage}
        busyLabel="Deleting…"
      />

      {showAddPackageModal ? (
        <ModalShell title="Add Credit Package" onClose={() => setShowAddPackageModal(false)}>
          <div className="space-y-4">
            <input
              type="text"
              value={newPackage.name}
              onChange={(event) => setNewPackage({ ...newPackage, name: event.target.value })}
              placeholder="Package name"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand"
            />
            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                value={newPackage.credits}
                onChange={(event) => setNewPackage({ ...newPackage, credits: Number.parseInt(event.target.value, 10) || 0 })}
                min="1"
                placeholder="Credits"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand"
              />
              <input
                type="number"
                value={newPackage.price}
                onChange={(event) => setNewPackage({ ...newPackage, price: Number.parseInt(event.target.value, 10) || 0 })}
                min="1"
                placeholder="Price"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand"
              />
            </div>
            <input
              type="number"
              value={newPackage.discount}
              onChange={(event) => setNewPackage({ ...newPackage, discount: Number.parseInt(event.target.value, 10) || 0 })}
              min="0"
              max="100"
              placeholder="Discount"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand"
            />
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={newPackage.popular}
                onChange={(event) => setNewPackage({ ...newPackage, popular: event.target.checked })}
              />
              Mark as popular
            </label>
            <button
              type="button"
              onClick={handleAddPackage}
              className="w-full rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover"
            >
              Add Package
            </button>
          </div>
        </ModalShell>
      ) : null}

      {showEditPackageModal && editingPackage ? (
        <ModalShell
          title="Edit Credit Package"
          onClose={() => {
            setShowEditPackageModal(false)
            setEditingPackage(null)
          }}
        >
          <div className="space-y-4">
            <input
              type="text"
              value={editingPackage.name}
              onChange={(event) => setEditingPackage({ ...editingPackage, name: event.target.value })}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand"
            />
            <div className="grid grid-cols-2 gap-4">
              <input
                type="number"
                value={editingPackage.credits}
                onChange={(event) => setEditingPackage({ ...editingPackage, credits: Number.parseInt(event.target.value, 10) || 0 })}
                min="1"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand"
              />
              <input
                type="number"
                value={editingPackage.price}
                onChange={(event) => setEditingPackage({ ...editingPackage, price: Number.parseInt(event.target.value, 10) || 0 })}
                min="1"
                className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand"
              />
            </div>
            <input
              type="number"
              value={editingPackage.discount}
              onChange={(event) => setEditingPackage({ ...editingPackage, discount: Number.parseInt(event.target.value, 10) || 0 })}
              min="0"
              max="100"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand"
            />
            <label className="flex items-center gap-3 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={editingPackage.popular}
                onChange={(event) => setEditingPackage({ ...editingPackage, popular: event.target.checked })}
              />
              Mark as popular
            </label>
            <button
              type="button"
              onClick={handleUpdatePackage}
              className="w-full rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover"
            >
              Save Changes
            </button>
          </div>
        </ModalShell>
      ) : null}

      {showCreditModal && selectedUserForCredit ? (
        <ModalShell
          title="Modify User Credits"
          onClose={() => {
            setShowCreditModal(false)
            setSelectedUserForCredit(null)
          }}
        >
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
              <p>
                User: <span className="font-semibold text-slate-900">{selectedUserForCredit.name || 'Unknown'}</span>
              </p>
              <p className="mt-1">
                Email: <span className="font-medium text-slate-900">{selectedUserForCredit.email}</span>
              </p>
              <p className="mt-1">
                Current Credits:{' '}
                <span className="font-bold text-brand">{selectedUserForCredit.credits || 0}</span>
              </p>
            </div>
            <select
              value={creditAction}
              onChange={(event) => setCreditAction(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand"
            >
              <option value="add">Add Credits</option>
              <option value="subtract">Subtract Credits</option>
              <option value="set">Set Credits</option>
            </select>
            <input
              type="number"
              value={creditAmount}
              onChange={(event) => setCreditAmount(Number.parseInt(event.target.value, 10) || 0)}
              min="0"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-brand"
            />
            <button
              type="button"
              onClick={handleUpdateUserCredits}
              className="w-full rounded-2xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-hover"
            >
              Apply Changes
            </button>
          </div>
        </ModalShell>
      ) : null}
    </div>
  )
}

export default AdminPricingSection
