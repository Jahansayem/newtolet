// Saved searches with in-site "new listings" counts (no email). Rows live in public.saved_searches
// (owner-only RLS, max 20 per user).
import { supabase } from './supabaseClient'
import { countNewListings } from './propertyCatalogService'

export const SAVED_SEARCHES_CHANGED_EVENT = 'saved-searches-updated'
const MAX_SAVED_SEARCHES = 20

const notifyChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SAVED_SEARCHES_CHANGED_EVENT))
  }
}

export const listSavedSearches = async (userId) => {
  if (!userId) {
    return { data: [], error: null }
  }

  const { data, error } = await supabase
    .from('saved_searches')
    .select('id, label, filters, last_seen_at, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(MAX_SAVED_SEARCHES)

  return { data: data || [], error }
}

export const createSavedSearch = async (userId, { label, filters }) => {
  const { data, error } = await supabase
    .from('saved_searches')
    .insert({ user_id: userId, label: String(label || '').slice(0, 120) || 'Saved search', filters })
    .select('id')
    .single()

  if (!error) notifyChanged()
  return { data, error }
}

export const deleteSavedSearch = async (id) => {
  const { error } = await supabase.from('saved_searches').delete().eq('id', id)
  if (!error) notifyChanged()
  return { error }
}

/** Opening a saved search resets its "new" counter. */
export const markSavedSearchSeen = async (id) => {
  const { error } = await supabase.from('saved_searches').update({ last_seen_at: new Date().toISOString() }).eq('id', id)
  if (!error) notifyChanged()
  return { error }
}

/** { [savedSearchId]: newListingCount } (failed lookups count as 0). */
export const getNewMatchCounts = async (savedSearches = []) => {
  const entries = await Promise.all(
    savedSearches.map(async (search) => {
      try {
        return [search.id, await countNewListings(search.filters || {}, search.last_seen_at)]
      } catch {
        return [search.id, 0]
      }
    })
  )

  return Object.fromEntries(entries)
}
