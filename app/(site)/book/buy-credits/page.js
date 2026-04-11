'use client'

import { Suspense } from 'react'
import PrivateRouter from '../../../../src/Component/Route/PrivateRouter.jsx'
import Book from '../../../../src/Component/Route/Book.jsx'

export default function BuyCreditsPage() {
  return (
    <Suspense fallback={null}>
      <PrivateRouter>
        <Book />
      </PrivateRouter>
    </Suspense>
  )
}
