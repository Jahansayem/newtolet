import { routeMetadata } from '../../src/lib/seo/siteMeta.js'

export const metadata = routeMetadata('private', { path: '/admin/' })

export default function RouteLayout({ children }) {
  return children
}
