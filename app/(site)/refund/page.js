import PolicyPage from '../../../src/Component/Home/PolicyPage.jsx'
import { refundPolicy } from '../../../src/Component/Home/policyContent.js'

export const metadata = {
  title: 'Refund Policy | NewTolet.Com',
  description: 'Review the NewTolet refund policy for property orders, service deductions, and credit returns.',
}

export default function RefundPage() {
  return <PolicyPage policy={refundPolicy} />
}
