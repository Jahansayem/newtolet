import {
  getDivisionFromLegacySlug,
  getLegacyDivisionSlug,
} from '../../../../../src/Component/Home/propertySearch.js'
import { buildRouteMetadata } from '../../../../../src/lib/seo/siteMeta.js'
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

export async function generateMetadata({ params }) {
  const { divisionSlug } = await params
  const division = getDivisionFromLegacySlug(divisionSlug) || 'Bangladesh'
  return buildRouteMetadata({
    title: `House, Flat & Room Rent in ${division} Division | NewTolet`,
    description: `Rental listings across ${division} Division: family flats, bachelor rooms, sublets, hostels, offices and shops. Filter by district, area, rent, bedrooms and bathrooms.`,
    path: `/bd/property-division/${divisionSlug}/`,
  })
}

export default async function LegacyPropertyDivisionPage({ params }) {
  const { divisionSlug } = await params
  const division = getDivisionFromLegacySlug(divisionSlug) || ''
  return <LegacyPropertyDivisionClient division={division} />
}
