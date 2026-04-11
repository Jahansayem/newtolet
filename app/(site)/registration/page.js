'use client'

import { Suspense } from 'react'
import Registration from '../../../src/Component/Route/Registration.jsx'

export default function RegistrationPage() {
  return (
    <Suspense fallback={null}>
      <Registration />
    </Suspense>
  )
}
