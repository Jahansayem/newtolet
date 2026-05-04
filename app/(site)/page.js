import { Suspense } from 'react'
import HomePageRedirect from '../../components/app/HomePageRedirect.jsx'
import HomeShellRouter from '../../components/app/HomeShellRouter.jsx'

export default function HomePage() {
  return (
    <Suspense fallback={<HomeShellRouter />}>
      <HomePageRedirect />
    </Suspense>
  )
}
