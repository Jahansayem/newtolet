'use client'

import { Suspense } from 'react'
import PrivateRouter from '../../../src/Component/Route/PrivateRouter.jsx'
import EditProperty from '../../../src/Component/Navber/EditProperty.jsx'

export default function EditPropertyPage() {
  return (
    <Suspense fallback={null}>
      <PrivateRouter>
        <EditProperty />
      </PrivateRouter>
    </Suspense>
  )
}
