'use client'

import { Suspense } from 'react'
import ResetPassword from '../../../src/Component/Route/ResetPassword.jsx'

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPassword />
    </Suspense>
  )
}
