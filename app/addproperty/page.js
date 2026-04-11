'use client'

import { Suspense, useEffect } from 'react'
import PrivateRouter from '../../src/Component/Route/PrivateRouter.jsx'
import Navber from '../../src/Component/Home/Navber.jsx'
import Addproperty from '../../src/Component/Navber/Addproperty.jsx'
import FloatingQuickRail from '../../components/app/FloatingQuickRail.jsx'

export default function AddPropertyPage() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <Suspense fallback={null}>
      <div className="min-h-screen bg-gray-50">
        <Navber />
        <FloatingQuickRail />
        <div className="max-w-full mx-auto">
          <PrivateRouter>
            <Addproperty />
          </PrivateRouter>
        </div>
      </div>
    </Suspense>
  )
}
