'use client'

import { Suspense } from 'react'
import PrivateRouter from '../../../src/Component/Route/PrivateRouter.jsx'
import MyOrders from '../../../src/Component/Navber/MyOrders.jsx'

export default function MyOrdersPage() {
  return (
    <Suspense fallback={null}>
      <PrivateRouter>
        <MyOrders />
      </PrivateRouter>
    </Suspense>
  )
}
