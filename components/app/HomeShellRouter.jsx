'use client'

import { Suspense } from 'react'
import Listprovaider from '../../src/Component/Route/Listprovaider.jsx'
import Home from '../../src/Component/Home/Home.jsx'

export default function HomeShellRouter() {
  return (
    <Suspense fallback={null}>
      <Listprovaider mode="home">
        <Home />
      </Listprovaider>
    </Suspense>
  )
}
