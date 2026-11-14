import { routeMetadata } from '../../../src/lib/seo/siteMeta.js'

export const metadata = routeMetadata('private', { path: '/my-properties/' })

export default function RouteLayout({ children }) {
  return children
}
