'use client'

import { Suspense } from 'react'
import CreateOrderForm from '../../../src/Component/Navber/CreateOrderForm.jsx'

export default function OrderhomePage() {
  return (
    <Suspense fallback={null}>
      <CreateOrderForm />
    </Suspense>
  )
}
