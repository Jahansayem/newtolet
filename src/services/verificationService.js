// Owner ID verification: the owner uploads front/back images of an ID to the private
// `id-documents` bucket and submits them for admin review. Approval sets users.verified,
// which shows a "Verified owner" badge on that owner's listings.
import { supabase } from './supabaseClient'
import { uploadIDDocument } from './imageUploadService'

export const ID_TYPES = ['National ID', 'Passport', 'Driving License']

/** The current user's verification request, or null if none was submitted. */
export const getMyVerification = async (userId) => {
  if (!userId) {
    return { data: null, error: null }
  }

  const { data, error } = await supabase
    .from('user_verifications')
    .select('id, id_type, verification_status, admin_notes, submitted_at, reviewed_at')
    .eq('user_id', userId)
    .maybeSingle()

  return { data: data || null, error }
}

export const submitVerification = async ({ userId, idType, frontFile, backFile }) => {
  if (!userId) {
    return { error: new Error('Please log in first.') }
  }

  try {
    const [frontPath, backPath] = await Promise.all([
      uploadIDDocument(frontFile, userId, 'front'),
      uploadIDDocument(backFile, userId, 'back'),
    ])

    const { data, error } = await supabase.rpc('submit_user_verification', {
      p_id_type: idType,
      p_front_path: frontPath,
      p_back_path: backPath,
    })

    if (error) {
      return { error }
    }

    return { data, error: null }
  } catch (error) {
    return { error }
  }
}

/**
 * Object path inside the bucket. Older rows stored a (non-working) public URL; strip it back to
 * the path so a signed URL can be created.
 */
export const toIdDocumentPath = (value = '') => {
  const text = String(value || '')
  const marker = '/id-documents/'
  const index = text.indexOf(marker)
  return index >= 0 ? decodeURIComponent(text.slice(index + marker.length).split('?')[0]) : text
}

/** Short-lived links an admin can open. Storage policies only allow the owner and admins. */
export const getIdDocumentLinks = async (paths = [], expiresInSeconds = 600) => {
  const cleanPaths = paths.map(toIdDocumentPath).filter(Boolean)

  if (!cleanPaths.length) {
    return []
  }

  const { data, error } = await supabase.storage.from('id-documents').createSignedUrls(cleanPaths, expiresInSeconds)

  if (error) {
    throw error
  }

  return (data || []).map((entry) => entry.signedUrl).filter(Boolean)
}
