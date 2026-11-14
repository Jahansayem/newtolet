'use client'

import Listprovaider from '../../../src/Component/Route/Listprovaider.jsx'
import Propertylist from '../../../src/Component/Navber/Propertylist.jsx'

export default function PropertyListPage() {
  return (
    <Listprovaider queryOptions={{ limit: 20 }}>
      <Propertylist />
    </Listprovaider>
  )
}
