'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAdminPermissions } from '../../contexts/AdminAccessContext'
import { formatRoleLabels } from '../../lib/adminPermissions'
import { ToastProvider } from '../ui/ToastProvider'
import InlineAlert from '../ui/InlineAlert'
import CoverPhotoManagement from '../../Component/Admin/CoverPhotoManagement.jsx'
import PaymentMonitoring from '../../Component/Admin/PaymentMonitoring.jsx'
import PropertyManagement from '../../Component/Admin/PropertyManagement.jsx'
import ReferralManagement from '../../Component/Admin/ReferralManagement.jsx'
import SearchHistoryManagement from '../../Component/Admin/SearchHistoryManagement.jsx'
import UserManagement from '../../Component/Admin/UserManagement.jsx'
import ContactUnlockRefundReview from '../../Component/Admin/ContactUnlockRefundReview.jsx'
import AdminShell from './AdminShell.jsx'
import { ADMIN_NAV_ITEMS, getAdminNavItem, getAdminPanelTitle, resolveAdminTab } from './adminPanelConfig.js'
import { useAdminQueueCounts } from './hooks/useAdminQueueCounts'
import AdminDashboardSection from './sections/AdminDashboardSection.jsx'
import AdminFeedbackSection from './sections/AdminFeedbackSection.jsx'
import AdminInquiriesSection from './sections/AdminInquiriesSection.jsx'
import AdminOrdersSection from './sections/AdminOrdersSection.jsx'
import AdminPricingSection from './sections/AdminPricingSection.jsx'

// Sections that still rely on the header search box until they get their own FilterBar.
const HEADER_SEARCH_TABS = new Set(['orders', 'inquiries', 'feedback'])

const AdminPanelApp = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const access = useAdminPermissions()
  const [searchQuery, setSearchQuery] = useState('')

  const { tab: activeMenu, view, aliased } = useMemo(() => resolveAdminTab(searchParams.get('tab')), [searchParams])

  // Rewrite legacy ?tab= aliases to the canonical key so bookmarks keep working.
  useEffect(() => {
    if (!aliased) return
    const next = new URLSearchParams(searchParams.toString())
    next.set('tab', activeMenu)
    if (view) next.set('view', view)
    setSearchParams(next, { replace: true })
  }, [aliased, activeMenu, view, searchParams, setSearchParams])

  useEffect(() => {
    setSearchQuery('')
  }, [activeMenu])

  const { counts } = useAdminQueueCounts({ enabled: access.isAdmin })

  const navItems = useMemo(
    () =>
      ADMIN_NAV_ITEMS.filter((item) => !item.stage && (item.key === 'home' || access.hasPermission(item.permission))).map((item) => {
        const badge = item.badgeKey && counts ? counts[item.badgeKey] : null
        return { ...item, badge: typeof badge === 'number' ? badge : null, badgeLabel: typeof badge === 'number' ? `${badge} pending` : undefined }
      }),
    [access, counts]
  )

  const activeItem = getAdminNavItem(activeMenu)
  const allowed = activeItem ? access.hasPermission(activeItem.permission) : false

  const handleMenuChange = (menuId) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set('tab', menuId)
    nextParams.delete('view')
    setSearchParams(nextParams)
  }

  const userMeta = {
    name: user?.name,
    detail: user?.email || user?.phone,
    roleLabel: access.isLegacyAdmin ? 'Super admin' : formatRoleLabels(access.roles),
  }

  const renderSection = () => {
    if (!allowed) {
      return <InlineAlert variant="permission" title="Permission required" />
    }
    switch (activeMenu) {
      case 'dashboard':
        return <AdminDashboardSection onQuickAction={handleMenuChange} />
      case 'payments':
        return <PaymentMonitoring />
      case 'referrals':
        return <ReferralManagement />
      case 'credits':
        return <AdminPricingSection />
      case 'content':
        return <CoverPhotoManagement />
      case 'users':
        return <UserManagement />
      case 'properties':
        return <PropertyManagement />
      case 'orders':
        return <AdminOrdersSection searchQuery={searchQuery} />
      case 'inquiries':
        return <AdminInquiriesSection searchQuery={searchQuery} />
      case 'search-history':
        return <SearchHistoryManagement />
      case 'feedback':
        return <AdminFeedbackSection searchQuery={searchQuery} />
      case 'refunds':
        return <ContactUnlockRefundReview />
      default:
        return <AdminDashboardSection onQuickAction={handleMenuChange} />
    }
  }

  return (
    <ToastProvider>
      <AdminShell
        activeKey={activeMenu}
        title={getAdminPanelTitle(activeMenu)}
        description={activeItem?.description || null}
        items={navItems}
        userMeta={userMeta}
        search={
          HEADER_SEARCH_TABS.has(activeMenu)
            ? { value: searchQuery, onChange: setSearchQuery, label: `Search ${getAdminPanelTitle(activeMenu).toLowerCase()}`, placeholder: `Search ${getAdminPanelTitle(activeMenu).toLowerCase()}…` }
            : null
        }
      >
        {renderSection()}
      </AdminShell>
    </ToastProvider>
  )
}

export default AdminPanelApp
