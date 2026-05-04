'use client'

import { Suspense } from 'react'
import Listprovaider from '../../../../../src/Component/Route/Listprovaider.jsx'
import Propertylist2 from '../../../../../src/Component/Navber/Propertylist2.jsx'

export default function LegacyPropertyDivisionClient() {
  return (
    <Suspense fallback={null}>
      <Listprovaider>
        <Propertylist2 />
      </Listprovaider>
    </Suspense>
  )
}
