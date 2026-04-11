import PolicyPage from '../../../src/Component/Home/PolicyPage.jsx'
import { termsPolicy } from '../../../src/Component/Home/policyContent.js'

export const metadata = {
  title: 'Terms & Conditions | NewTolet.Com',
  description: 'Read the NewTolet terms and conditions for account usage, listings, orders, credits, and platform rules.',
}

export default function TermsPage() {
  return <PolicyPage policy={termsPolicy} />
}
