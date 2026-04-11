'use client'

import React, { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import EarningsPanel from './EarningsPanel.jsx'
import ReferralPanel from './ReferralPanel.jsx'
import WalletsPanel from './WalletsPanel.jsx'
import WithdrawalsPanel from './WithdrawalsPanel.jsx'
import DashboardHomePanel from '../../components/user-panel/DashboardHomePanel.jsx'
import InvoicesPanel from '../../components/user-panel/InvoicesPanel.jsx'
import JobFeedPanel from '../../components/user-panel/JobFeedPanel.jsx'
import JobHistoryPanel from '../../components/user-panel/JobHistoryPanel.jsx'
import ProfilePanel from '../../components/user-panel/ProfilePanel.jsx'
import PropertyCollectionsPanel from '../../components/user-panel/PropertyCollectionsPanel.jsx'
import UserPanelShell from '../../components/user-panel/UserPanelShell.jsx'

const SUPPORTED_TABS = new Set([
  'dashboard',
  'profile',
  'saved',
  'unlocked-listings',
  'recently-viewed',
  'job-feed',
  'job-history',
  'referrals',
  'earnings',
  'wallets',
  'withdrawals',
  'invoice-history',
])

const Dashboard = () => {
  const [searchParams] = useSearchParams()
  const activeTab = useMemo(() => {
    const tab = searchParams.get('tab') || 'dashboard'
    return SUPPORTED_TABS.has(tab) ? tab : 'dashboard'
  }, [searchParams])

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfilePanel />
      case 'saved':
        return <PropertyCollectionsPanel type="saved" />
      case 'unlocked-listings':
        return <PropertyCollectionsPanel type="unlocked" />
      case 'recently-viewed':
        return <PropertyCollectionsPanel type="viewed" />
      case 'job-feed':
        return <JobFeedPanel />
      case 'job-history':
        return <JobHistoryPanel />
      case 'referrals':
        return <ReferralPanel />
      case 'earnings':
        return <EarningsPanel />
      case 'wallets':
        return <WalletsPanel />
      case 'withdrawals':
        return <WithdrawalsPanel />
      case 'invoice-history':
        return <InvoicesPanel />
      case 'dashboard':
      default:
        return <DashboardHomePanel />
    }
  }

  return <UserPanelShell activeKey={activeTab}>{renderContent()}</UserPanelShell>
}

export default Dashboard
