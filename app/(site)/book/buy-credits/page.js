'use client'

import { Suspense } from 'react'
import PrivateRouter from '../../../../src/Component/Route/PrivateRouter.jsx'
import BuyCredits from '../../../../src/Component/Navber/BuyCredits.jsx'

export default function BuyCreditsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="h-12 bg-gray-200 rounded-xl w-48 mx-auto mb-4"></div>
          <div className="h-64 bg-gray-200 rounded-2xl w-96 mx-auto"></div>
        </div>
      </div>
    }>
      <PrivateRouter>
        <BuyCredits />
      </PrivateRouter>
    </Suspense>
  )
}
