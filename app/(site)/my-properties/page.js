'use client'

import { Suspense } from 'react'
import PrivateRouter from '../../../src/Component/Route/PrivateRouter.jsx'
import MyProperties from '../../../src/Component/Navber/MyProperties.jsx'

export default function MyPropertiesPage() {
  return (
    <Suspense fallback={null}>
      <PrivateRouter>
        <MyProperties />
      </PrivateRouter>
    </Suspense>
  )
}
