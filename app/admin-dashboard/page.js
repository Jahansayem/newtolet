'use client'

import { Suspense } from 'react'
import AdminRoute from '../../src/Component/Route/AdminRoute.jsx'
import Admin from '../../src/Component/Home/Admin.jsx'

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={null}>
      <AdminRoute>
        <Admin />
      </AdminRoute>
    </Suspense>
  )
}
