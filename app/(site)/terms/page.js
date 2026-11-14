import { buildRouteMetadata } from '../../../src/lib/seo/siteMeta.js'
import PolicyPage from '../../../src/Component/Home/PolicyPage.jsx'
import { termsPolicy } from '../../../src/Component/Home/policyContent.js'

export const metadata = buildRouteMetadata({
  title: 'Terms & Conditions | NewTolet.Com',
  description: 'Read the NewTolet terms and conditions for account usage, listings, orders, credits, and platform rules.',
  path: '/terms/',
})

export default function TermsPage() {
  return <PolicyPage policy={termsPolicy} />
}
