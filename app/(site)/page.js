import HomePageRedirect from '../../components/app/HomePageRedirect.jsx'
import { routeMetadata } from '../../src/lib/seo/siteMeta.js'

export const metadata = routeMetadata('home')

export default function HomePage() {
  // Renders the home page and redirects legacy /?page=<name> links to their real routes.
  return <HomePageRedirect />
}
