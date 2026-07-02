'use client'

import PrivateRouter from '../../../src/Component/Route/PrivateRouter.jsx'
import MyOrders from '../../../src/Component/Navber/MyOrders.jsx'

export default function MyOrdersPage() {
  return (
    <PrivateRouter>
      <MyOrders />
    </PrivateRouter>
  )
}
