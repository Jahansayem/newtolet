import PolicyPage from '../../../src/Component/Home/PolicyPage.jsx'
import { privacyPolicy } from '../../../src/Component/Home/policyContent.js'

export const metadata = {
  title: 'Privacy Policy | NewTolet.Com',
  description: 'Review how NewTolet collects, uses, stores, and protects personal and usage data.',
}

export default function PrivacyPage() {
  return <PolicyPage policy={privacyPolicy} />
}
