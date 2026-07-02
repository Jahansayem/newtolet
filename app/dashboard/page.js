'use client'

import { Suspense } from 'react'
import Navber from '../../src/Component/Home/Navber.jsx'
import Dashboard from '../../src/Component/Dashboard/Dashboard.jsx'
import PrivateRouter from '../../src/Component/Route/PrivateRouter.jsx'
import FloatingQuickRail from '../../components/app/FloatingQuickRail.jsx'
import Footer from '../../src/Component/Home/Footer.jsx'

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <div className="min-h-screen bg-gray-50">
        <Navber />
        <FloatingQuickRail />
        <div className="max-w-full mx-auto">
          <PrivateRouter>
            <Dashboard />
          </PrivateRouter>
        </div>
        <Footer />
      </div>
    </Suspense>
  )
}
