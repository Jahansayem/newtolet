// Calls an admin_* Postgres RPC. The actor is always auth.uid() on the server;
// no wrapper ever sends an admin id. RPCs return either
//   { row, audit_id }            single-row mutations
//   { rows, count, audit_id }    bulk mutations
//   setof / table rows           legacy and read-only functions (no audit id)

import { supabase } from '../supabaseClient'
import { fail, ok } from './adminResult'

const extractAudit = (payload) => {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const auditId = payload.audit_id ?? null
    if ('row' in payload) return { data: payload.row, auditId, envelope: payload }
    if ('rows' in payload) return { data: payload.rows, auditId, envelope: payload }
    return { data: payload, auditId, envelope: payload }
  }
  return { data: payload, auditId: null, envelope: null }
}

/**
 * @param {string} name RPC name
 * @param {object} args RPC arguments (business data only)
 * @param {{ signal?: AbortSignal, map?: (data: any, envelope: any) => any }} [options]
 */
export const callAdminRpc = async (name, args = {}, { signal, map } = {}) => {
  try {
    let query = supabase.rpc(name, args)
    if (signal && typeof query.abortSignal === 'function') query = query.abortSignal(signal)
    const { data, error } = await query
    if (error) return fail(error)
    const { data: payload, auditId, envelope } = extractAudit(data)
    const extra = {}
    if (envelope && typeof envelope.count === 'number') extra.count = envelope.count
    if (envelope && Array.isArray(envelope.audit_ids)) extra.auditIds = envelope.audit_ids
    return ok(map ? map(payload, envelope) : payload, { auditId: auditId === null ? null : String(auditId), ...extra })
  } catch (error) {
    return fail(error)
  }
}
