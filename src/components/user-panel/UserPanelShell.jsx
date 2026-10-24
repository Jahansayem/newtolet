'use client'

import React, { useMemo } from 'react'
import SharedPanelShell from '../panel/SharedPanelShell.jsx'
import { useLanguage } from '../../i18n/useLanguage'
import { getUserPanelTitle, USER_PANEL_NAV_ITEMS } from './panelConfig'

const UserPanelShell = ({ activeKey, title, children, headerActions = null }) => {
  const { t } = useLanguage()

  const items = useMemo(
    () =>
      USER_PANEL_NAV_ITEMS.map((item) => ({
        ...item,
        label: t(item.labelKey),
        section: item.sectionKey ? t(item.sectionKey) : undefined,
      })),
    [t]
  )

  const labels = useMemo(
    () => ({
      accountUser: t('dashboard.shell.accountUser'),
      noPhone: t('dashboard.shell.noPhone'),
      logOut: t('dashboard.shell.logOut'),
      openMenu: t('dashboard.shell.openMenu'),
      closeMenu: t('dashboard.shell.closeMenu'),
      navigation: t('dashboard.shell.navigation'),
    }),
    [t]
  )

  return (
    <SharedPanelShell
      activeKey={activeKey}
      title={title}
      headerActions={headerActions}
      items={items}
      getTitle={(key) => getUserPanelTitle(key, t)}
      panelLabel={t('dashboard.panelLabel')}
      labels={labels}
      logoHref="/"
      stickyTopClassName="top-[var(--nav-h)]"
      sidebarBreakpoint="xl"
    >
      {children}
    </SharedPanelShell>
  )
}

export default UserPanelShell
