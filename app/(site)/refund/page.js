import { buildRouteMetadata } from '../../../src/lib/seo/siteMeta.js'
import PolicyPage from '../../../src/Component/Home/PolicyPage.jsx'
import { refundPolicy } from '../../../src/Component/Home/policyContent.js'

export const metadata = buildRouteMetadata({
  title: 'Refund Policy | NewTolet.Com',
  description: 'Review the NewTolet refund policy for property orders, service deductions, and credit returns.',
  path: '/refund/',
})

export default function RefundPage() {
  return <PolicyPage policy={refundPolicy} />
}
