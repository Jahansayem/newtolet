import { routeMetadata } from '../../src/lib/seo/siteMeta.js'

// A payment link is private to the customer it was sent to: never indexed.
export const metadata = routeMetadata('private', {
  path: '/pay/',
  title: 'Pay NewTolet | NewTolet.Com',
  description: 'Pay NewTolet securely through EPS.',
})

export default function RouteLayout({ children }) {
  return children
}
