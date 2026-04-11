'use client'

import { Suspense } from 'react'
import AdminRoute from '../../src/Component/Route/AdminRoute.jsx'
import AdminDashboard from '../../src/Component/Admin/AdminDashboard.jsx'

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={null}>
      <AdminRoute>
        <AdminDashboard />
      </AdminRoute>
    </Suspense>
  )
}
