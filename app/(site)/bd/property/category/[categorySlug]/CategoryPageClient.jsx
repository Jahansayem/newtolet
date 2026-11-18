'use client'

import { Suspense } from 'react'
import Listprovaider from '../../../../../../src/Component/Route/Listprovaider.jsx'
import Propertylist2 from '../../../../../../src/Component/Navber/Propertylist2.jsx'

// Same search page as /bd/property-listing/; it reads the category from the path
// (getSearchRouteContext) and shows the category heading and intro.
export default function CategoryPageClient() {
  return (
    <Suspense fallback={null}>
      <Listprovaider mode="none">
        <Propertylist2 />
      </Listprovaider>
    </Suspense>
  )
}
