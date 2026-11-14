'use client'

import React, { useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAdminPermissions } from '../../contexts/AdminAccessContext'
import { formatRoleLabels } from '../../lib/adminPermissions'
import { ToastProvider } from '../ui/ToastProvider'
import InlineAlert from '../ui/InlineAlert'
import PaymentMonitoring from '../../Component/Admin/PaymentMonitoring.jsx'
import ReferralManagement from '../../Component/Admin/ReferralManagement.jsx'
import SearchHistoryManagement from '../../Component/Admin/SearchHistoryManagement.jsx'
import UserManagement from '../../Component/Admin/UserManagement.jsx'
import ContactUnlockRefundReview from '../../Component/Admin/ContactUnlockRefundReview.jsx'
import AdminShell from './AdminShell.jsx'
import { ADMIN_NAV_ITEMS, getAdminNavItem, getAdminPanelTitle, resolveAdminTab } from './adminPanelConfig.js'
import { useAdminQueueCounts } from './hooks/useAdminQueueCounts'
import AdminAnalyticsSection from './sections/AdminAnalyticsSection.jsx'
import AdminAuditLogSection from './sections/AdminAuditLogSection.jsx'
import AdminContentSection from './sections/AdminContentSection.jsx'
import AdminCustomersSection from './sections/AdminCustomersSection.jsx'
import AdminDashboardSection from './sections/AdminDashboardSection.jsx'
import AdminFeedbackSection from './sections/AdminFeedbackSection.jsx'
import AdminVerificationsSection from './sections/AdminVerificationsSection.jsx'
import AdminReportsSection from './sections/AdminReportsSection.jsx'
import AdminInquiriesSection from './sections/AdminInquiriesSection.jsx'
import AdminOrdersSection from './sections/AdminOrdersSection.jsx'
import AdminPricingSection from './sections/AdminPricingSection.jsx'
import AdminPropertiesSection from './sections/AdminPropertiesSection.jsx'
import AdminSettingsSection from './sections/AdminSettingsSection.jsx'

const AdminPanelApp = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const access = useAdminPermissions()

  const { tab: activeMenu, view, aliased } = useMemo(() => resolveAdminTab(searchParams.get('tab')), [searchParams])

  // Rewrite legacy ?tab= aliases to the canonical key so bookmarks keep working.
  useEffect(() => {
    if (!aliased) return
    const next = new URLSearchParams(searchParams.toString())
    next.set('tab', activeMenu)
    if (view) next.set('view', view)
    setSearchParams(next, { replace: true })
  }, [aliased, activeMenu, view, searchParams, setSearchParams])

  const { counts } = useAdminQueueCounts({ enabled: access.isAdmin })

  const navItems = useMemo(
    () =>
      ADMIN_NAV_ITEMS.filter((item) => !item.stage && access.hasPermission(item.permission)).map((item) => {
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
    nextParams.delete('edit')
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
        return <AdminContentSection />
      case 'analytics':
        return <AdminAnalyticsSection />
      case 'customers':
        return <AdminCustomersSection />
      case 'settings':
        return <AdminSettingsSection />
      case 'audit':
        return <AdminAuditLogSection />
      case 'users':
        return <UserManagement />
      case 'properties':
        return <AdminPropertiesSection />
      case 'orders':
        return <AdminOrdersSection />
      case 'inquiries':
        return <AdminInquiriesSection />
      case 'search-history':
        return <SearchHistoryManagement />
      case 'feedback':
        return <AdminFeedbackSection />
      case 'verifications':
        return <AdminVerificationsSection />
      case 'reports':
        return <AdminReportsSection />
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
      >
        {renderSection()}
      </AdminShell>
    </ToastProvider>
  )
}

export default AdminPanelApp
