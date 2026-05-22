'use client'

import { Suspense } from 'react'
import Listprovaider from '../../src/Component/Route/Listprovaider.jsx'
import Home from '../../src/Component/Home/Home.jsx'
import HomePageSkeleton from './HomePageSkeleton.jsx'

export default function HomeShellRouter() {
  return (
    <Listprovaider mode="home">
      <Suspense fallback={<HomePageSkeleton />}>
        <Home />
      </Suspense>
    </Listprovaider>
  )
}
