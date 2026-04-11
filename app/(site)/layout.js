import { Suspense } from 'react'
import SiteChrome from '../../components/app/SiteChrome.jsx'

export default function SiteLayout({ children }) {
  return <Suspense fallback={children}><SiteChrome>{children}</SiteChrome></Suspense>
}
