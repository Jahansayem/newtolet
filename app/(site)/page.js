import HomeShellRouter from '../../components/app/HomeShellRouter.jsx'
import { routeMetadata } from '../../src/lib/seo/siteMeta.js'

export const metadata = routeMetadata('home')

export default function HomePage() {
  return <HomeShellRouter />
}
