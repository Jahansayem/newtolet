'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { getStoredUser } from '../../services/authService'
import CoverPhotoManagement from '../../Component/Admin/CoverPhotoManagement.jsx'
import PaymentMonitoring from '../../Component/Admin/PaymentMonitoring.jsx'
import PropertyManagement from '../../Component/Admin/PropertyManagement.jsx'
import ReferralManagement from '../../Component/Admin/ReferralManagement.jsx'
import SearchHistoryManagement from '../../Component/Admin/SearchHistoryManagement.jsx'
import UserManagement from '../../Component/Admin/UserManagement.jsx'
import ContactUnlockRefundReview from '../../Component/Admin/ContactUnlockRefundReview.jsx'
import AdminShell from './AdminShell.jsx'
import {
  getAdminPanelNavItems,
  getAdminPanelTitle,
  getSupportedAdminTabs,
} from './adminPanelConfig.js'
import AdminDashboardSection from './sections/AdminDashboardSection.jsx'
import AdminFeedbackSection from './sections/AdminFeedbackSection.jsx'
import AdminInquiriesSection from './sections/AdminInquiriesSection.jsx'
import AdminOrdersSection from './sections/AdminOrdersSection.jsx'
import AdminPricingSection from './sections/AdminPricingSection.jsx'

const AdminPanelApp = () => {
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [currentUser, setCurrentUser] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')

  const adminPageKey = location.pathname === '/admin-dashboard' ? 'admin-dashboard' : 'admin'
  const adminNavItems = useMemo(() => getAdminPanelNavItems(adminPageKey), [adminPageKey])
  const supportedTabs = useMemo(() => new Set(getSupportedAdminTabs(adminPageKey)), [adminPageKey])
  const activeMenu = useMemo(() => {
    const requestedTab = searchParams.get('tab') || 'dashboard'
    return supportedTabs.has(requestedTab) ? requestedTab : 'dashboard'
  }, [searchParams, supportedTabs])

  useEffect(() => {
    const user = getStoredUser()
    if (user) {
      setCurrentUser(user)
    }
  }, [])

  useEffect(() => {
    setSearchQuery('')
  }, [activeMenu])

  const handleMenuChange = (menuId) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.set('tab', menuId)
    setSearchParams(nextParams)
  }

  const showSearch = ['orders', 'inquiries', 'feedback'].includes(activeMenu)

  return (
    <AdminShell
      activeKey={activeMenu}
      title={getAdminPanelTitle(activeMenu, adminPageKey)}
      items={adminNavItems}
      currentUserName={currentUser?.name}
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      showSearch={showSearch}
    >
      {activeMenu === 'dashboard' ? <AdminDashboardSection onQuickAction={handleMenuChange} /> : null}
      {activeMenu === 'payments' ? <PaymentMonitoring /> : null}
      {activeMenu === 'referrals' ? <ReferralManagement /> : null}
      {activeMenu === 'pricing' ? <AdminPricingSection /> : null}
      {activeMenu === 'cover-photos' ? <CoverPhotoManagement /> : null}
      {activeMenu === 'users' ? <UserManagement /> : null}
      {activeMenu === 'properties' ? <PropertyManagement /> : null}
      {activeMenu === 'orders' ? <AdminOrdersSection searchQuery={searchQuery} /> : null}
      {activeMenu === 'inquiries' ? <AdminInquiriesSection searchQuery={searchQuery} /> : null}
      {activeMenu === 'search-history' ? <SearchHistoryManagement /> : null}
      {activeMenu === 'feedback' ? <AdminFeedbackSection searchQuery={searchQuery} /> : null}
      {activeMenu === 'unlock-refunds' ? <ContactUnlockRefundReview /> : null}
    </AdminShell>
  )
}

export default AdminPanelApp
