import { routeMetadata } from '../../src/lib/seo/siteMeta.js'

export const metadata = routeMetadata('private', { path: '/payment-confirm/' })

export default function RouteLayout({ children }) {
  return children
}
