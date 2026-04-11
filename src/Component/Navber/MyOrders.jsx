'use client'

import React from 'react'
import OrdersHistoryPanel from '../../components/user-panel/OrdersHistoryPanel.jsx'
import UserPanelShell from '../../components/user-panel/UserPanelShell.jsx'

export default function MyOrders() {
  return (
    <UserPanelShell activeKey="orders">
      <OrdersHistoryPanel />
    </UserPanelShell>
  )
}
