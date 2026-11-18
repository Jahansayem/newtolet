'use client'

import { Suspense } from 'react'
import PaymentLinkPage from '../../src/Component/Pay/PaymentLinkPage.jsx'

export default function PayRoutePage() {
  return (
    <Suspense fallback={null}>
      <PaymentLinkPage />
    </Suspense>
  )
}
