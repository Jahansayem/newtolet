import { getLegacyDivisionSlug } from '../../../../../src/Component/Home/propertySearch.js'
import LegacyPropertyDivisionClient from './LegacyPropertyDivisionClient.jsx'

const STATIC_DIVISIONS = [
  'Barishal',
  'Chattogram',
  'Dhaka',
  'Khulna',
  'Mymensingh',
  'Rajshahi',
  'Rangpur',
  'Sylhet',
]

export function generateStaticParams() {
  return STATIC_DIVISIONS.map((division) => ({
    divisionSlug: getLegacyDivisionSlug(division),
  }))
}

export default function LegacyPropertyDivisionPage() {
  return <LegacyPropertyDivisionClient />
}
