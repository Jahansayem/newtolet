'use client'

import React from 'react'
import SharedPanelShell from '../panel/SharedPanelShell.jsx'
import { getUserPanelTitle, USER_PANEL_NAV_ITEMS } from './panelConfig'

const UserPanelShell = ({ activeKey, title, children, headerActions = null }) => (
  <SharedPanelShell
    activeKey={activeKey}
    title={title}
    headerActions={headerActions}
    items={USER_PANEL_NAV_ITEMS}
    getTitle={getUserPanelTitle}
    panelLabel="User Panel"
    logoHref="/"
  >
    {children}
  </SharedPanelShell>
)

export default UserPanelShell
