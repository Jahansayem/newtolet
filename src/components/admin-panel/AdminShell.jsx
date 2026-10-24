'use client'

import React from 'react'
import SharedPanelShell from '../panel/SharedPanelShell.jsx'
import { ADMIN_SECTION_ORDER } from './adminPanelConfig'

const ADMIN_LABELS = {
  accountUser: 'Admin',
  noPhone: 'No contact added',
  logOut: 'Log out',
  openMenu: 'Open navigation',
  closeMenu: 'Close navigation',
  navigation: 'Admin navigation',
  skipToContent: 'Skip to content',
}

/** Admin configuration of the shared panel shell. */
const AdminShell = ({ activeKey, items, title, description = null, userMeta = null, headerActions = null, search = null, children }) => (
  <SharedPanelShell
    activeKey={activeKey}
    items={items}
    title={title}
    description={description}
    headerActions={headerActions}
    search={search}
    sidebarBreakpoint="lg"
    panelLabel="NewTolet Admin"
    logoHref="/"
    userMeta={userMeta}
    sectionOrder={ADMIN_SECTION_ORDER}
    labels={ADMIN_LABELS}
  >
    {children}
  </SharedPanelShell>
)

export default AdminShell
