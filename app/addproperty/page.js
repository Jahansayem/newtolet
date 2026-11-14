'use client'

import { Suspense, useEffect } from 'react'
import PrivateRouter from '../../src/Component/Route/PrivateRouter.jsx'
import Navber from '../../src/Component/Home/Navber.jsx'
import Addproperty from '../../src/Component/Navber/Addproperty.jsx'
import FloatingQuickRail from '../../components/app/FloatingQuickRail.jsx'
import Footer from '../../src/Component/Home/Footer.jsx'

export default function AddPropertyPage() {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <Suspense fallback={null}>
      <div className="site-main min-h-screen bg-gray-50">
        <Navber />
        <FloatingQuickRail />
        <main id="main-content" className="max-w-full mx-auto">
          <PrivateRouter>
            <Addproperty />
          </PrivateRouter>
        </main>
        <Footer />
      </div>
    </Suspense>
  )
}
