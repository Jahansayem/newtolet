'use client'

import { Suspense } from 'react'
import Listdetails from '../../../src/Component/Home/Listdetails.jsx'

export default function ListDetailsPage() {
  return (
    <Suspense fallback={null}>
      <Listdetails />
    </Suspense>
  )
}
