import { Suspense } from 'react'
import HomeShellRouter from '../../components/app/HomeShellRouter.jsx'

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <HomeShellRouter />
    </Suspense>
  )
}
