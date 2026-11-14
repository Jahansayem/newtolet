'use client'

import { useEffect } from 'react'
import { SITE_URL } from './siteMeta.js'

const JSON_LD_ID = 'page-jsonld'

const upsertMeta = (attribute, key, content) => {
  if (!content) return
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.appendChild(element)
  }
  element.setAttribute('content', content)
}

const upsertCanonical = (href) => {
  if (!href) return
  let element = document.head.querySelector('link[rel="canonical"]')
  if (!element) {
    element = document.createElement('link')
    element.setAttribute('rel', 'canonical')
    document.head.appendChild(element)
  }
  element.setAttribute('href', href)
}

/**
 * Per-record <head> for pages whose content is only known in the browser (static export,
 * listing data from Supabase). Google renders JavaScript, so these tags are indexed.
 * Pass null/undefined fields to leave the static tags from the route layout in place.
 *
 * @param {{ title?: string, description?: string, canonicalPath?: string, image?: string, jsonLd?: object }} head
 */
export function useDocumentHead(head) {
  const title = head?.title || ''
  const description = head?.description || ''
  const canonicalPath = head?.canonicalPath || ''
  const image = head?.image || ''
  const jsonLdText = head?.jsonLd ? JSON.stringify(head.jsonLd) : ''

  useEffect(() => {
    if (typeof document === 'undefined') return undefined
    const previousTitle = document.title

    if (title) {
      document.title = title
      upsertMeta('property', 'og:title', title)
      upsertMeta('name', 'twitter:title', title)
    }
    if (description) {
      upsertMeta('name', 'description', description)
      upsertMeta('property', 'og:description', description)
      upsertMeta('name', 'twitter:description', description)
    }
    if (canonicalPath) {
      const href = new URL(canonicalPath, SITE_URL).toString()
      upsertCanonical(href)
      upsertMeta('property', 'og:url', href)
    }
    if (image) {
      upsertMeta('property', 'og:image', image)
      upsertMeta('name', 'twitter:image', image)
    }

    let script = null
    if (jsonLdText) {
      script = document.getElementById(JSON_LD_ID)
      if (!script) {
        script = document.createElement('script')
        script.type = 'application/ld+json'
        script.id = JSON_LD_ID
        document.head.appendChild(script)
      }
      script.textContent = jsonLdText
    }

    return () => {
      if (title) document.title = previousTitle
      if (script) script.remove()
    }
  }, [title, description, canonicalPath, image, jsonLdText])
}
