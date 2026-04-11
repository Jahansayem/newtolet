'use client'

import { Suspense } from 'react'
import Login from '../../../src/Component/Route/Login.jsx'

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <Login />
    </Suspense>
  )
}
