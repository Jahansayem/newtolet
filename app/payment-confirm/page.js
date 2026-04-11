'use client'

import { Suspense } from 'react'
import PaymentConfirmPage from '../../src/Component/Navber/PaymentConfirmPage.jsx'

export default function PaymentConfirmRoutePage() {
  return (
    <Suspense fallback={null}>
      <PaymentConfirmPage />
    </Suspense>
  )
}
