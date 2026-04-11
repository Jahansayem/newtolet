'use client'

import { Suspense } from 'react'
import Dashboard from '../../src/Component/Dashboard/Dashboard.jsx'
import PrivateRouter from '../../src/Component/Route/PrivateRouter.jsx'

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <PrivateRouter>
        <Dashboard />
      </PrivateRouter>
    </Suspense>
  )
}
