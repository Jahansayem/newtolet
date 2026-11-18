import { notFound } from 'next/navigation'
import { buildRouteMetadata } from '../../../../../../src/lib/seo/siteMeta.js'
import {
  CATEGORY_PAGE_SLUGS,
  categoryPageJsonLd,
  getCategoryFromSlug,
  getCategoryPageSeo,
  serializeJsonLd,
} from '../../../../../../src/lib/seo/categoryPages.js'
import CategoryPageClient from './CategoryPageClient.jsx'

// Static export: one page per category, built ahead of time. No other slugs exist.
export const dynamicParams = false

export function generateStaticParams() {
  return CATEGORY_PAGE_SLUGS.map((categorySlug) => ({ categorySlug }))
}

export async function generateMetadata({ params }) {
  const { categorySlug } = await params
  const seo = getCategoryPageSeo(getCategoryFromSlug(categorySlug))
  return seo ? buildRouteMetadata(seo) : {}
}

export default async function CategoryPage({ params }) {
  const { categorySlug } = await params
  const category = getCategoryFromSlug(categorySlug)

  if (!category) {
    notFound()
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(categoryPageJsonLd(category)) }} />
      <CategoryPageClient />
    </>
  )
}
