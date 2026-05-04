import { supabase } from './supabaseClient'

const PROPERTY_REPORTS_STORAGE_KEY = 'propertyReports'

const writeLocalPropertyReport = (report) => {
  if (typeof window === 'undefined') {
    return report
  }

  const localReport = {
    id: `local-${Date.now()}`,
    ...report,
    status: 'pending',
    created_at: new Date().toISOString(),
    source: 'local_storage',
  }

  try {
    const existingReports = JSON.parse(localStorage.getItem(PROPERTY_REPORTS_STORAGE_KEY) || '[]')
    const reports = Array.isArray(existingReports) ? existingReports : []
    localStorage.setItem(PROPERTY_REPORTS_STORAGE_KEY, JSON.stringify([localReport, ...reports]))
  } catch (error) {
    console.error('Error saving property report locally:', error)
  }

  return localReport
}

export const submitPropertyReport = async ({
  propertyId,
  userId = null,
  reason,
  message = '',
}) => {
  if (!propertyId) {
    throw new Error('Property is required.')
  }

  if (!reason?.trim()) {
    throw new Error('Report reason is required.')
  }

  const report = {
    property_id: propertyId,
    user_id: userId || null,
    reason: reason.trim(),
    message: message.trim() || null,
  }

  try {
    const { data, error } = await supabase
      .from('property_reports')
      .insert(report)
      .select()
      .single()

    if (error) {
      throw error
    }

    return { data, error: null, isLocalFallback: false }
  } catch (error) {
    console.error('Error submitting property report:', error)
    return {
      data: writeLocalPropertyReport(report),
      error: null,
      isLocalFallback: true,
    }
  }
}
