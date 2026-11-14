import { routeMetadata } from '../../../src/lib/seo/siteMeta.js'

export const metadata = routeMetadata('private', { path: '/orderhome/' })

export default function RouteLayout({ children }) {
  return children
}
