import {
    isRecoverableSupabaseError,
    isSupabaseConnectionUnavailable,
    isSupabaseProjectRestricted,
    supabase
} from './supabaseClient';
import { readSnapshot, writeSnapshot } from './cacheService';

export const getApprovedFeedbackCacheKey = () => 'feedback:approved';

const getErrorMessage = (error) => {
    if (!error) {
        return 'Unknown error';
    }

    if (typeof error === 'string') {
        return error;
    }

    return error.message || error.details || error.hint || JSON.stringify(error);
};

const getApprovedFeedbackFallback = (cacheKey, error = null) => {
    const cachedFeedback = readSnapshot(cacheKey);

    if (cachedFeedback) {
        if (process.env.NODE_ENV === 'development' && error && !isRecoverableSupabaseError(error)) {
            console.warn(`Using cached approved feedback after fetch failed: ${getErrorMessage(error)}`);
        }

        return { data: cachedFeedback, error: null };
    }

    if (error && process.env.NODE_ENV === 'development' && !isRecoverableSupabaseError(error)) {
        console.warn('Approved feedback unavailable:', error);
    }

    return { data: [], error: null };
};

/**
 * Submit new feedback
 * @param {Object} feedbackData - The feedback data
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const submitFeedback = async (feedbackData) => {
    try {
        const { data, error } = await supabase
            .from('feedback')
            .insert({
                user_id: feedbackData.userId || null,
                name: feedbackData.name,
                feedback: feedbackData.feedback,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        const errorMessage = getErrorMessage(error);
        console.error('Error submitting feedback:', errorMessage, error);
        return { data: null, error: { message: errorMessage, ...error } };
    }
};

/**
 * Get all feedback (for admin)
 * @returns {Promise<{data: Array|null, error: Object|null}>}
 */
export const getAllFeedback = async () => {
    try {
        const { data, error } = await supabase
            .from('feedback')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        const errorMessage = getErrorMessage(error);
        console.error('Error fetching feedback:', errorMessage, error);
        return { data: null, error: { message: errorMessage, ...error } };
    }
};

/**
 * Get approved feedback (for public display)
 * @returns {Promise<{data: Array|null, error: Object|null}>}
 */
export const getApprovedFeedback = async () => {
    const cacheKey = getApprovedFeedbackCacheKey();

    if (isSupabaseProjectRestricted() || isSupabaseConnectionUnavailable()) {
        return getApprovedFeedbackFallback(cacheKey);
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        return getApprovedFeedbackFallback(cacheKey);
    }

    try {
        const { data, error } = await supabase
            .from('feedback')
            .select('*')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });

        if (error) {
            return getApprovedFeedbackFallback(cacheKey, error);
        }

        const approvedFeedback = data || [];
        writeSnapshot(cacheKey, approvedFeedback);
        return { data: approvedFeedback, error: null };
    } catch (error) {
        return getApprovedFeedbackFallback(cacheKey, error);
    }
};

/**
 * Update feedback status (approve/reject)
 * @param {string} feedbackId - The feedback ID
 * @param {string} status - New status ('pending', 'approved', 'rejected')
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const updateFeedbackStatus = async (feedbackId, status) => {
    try {
        const { data, error } = await supabase
            .from('feedback')
            .update({ status })
            .eq('id', feedbackId)
            .select();

        if (error) throw error;
        return { data: data?.[0] || null, error: null };
    } catch (error) {
        const errorMessage = getErrorMessage(error);
        console.error('Error updating feedback status:', errorMessage, error);
        return { data: null, error: { message: errorMessage, ...error } };
    }
};

/**
 * Delete feedback
 * @param {string} feedbackId - The feedback ID
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const deleteFeedback = async (feedbackId) => {
    try {
        const { data, error } = await supabase
            .from('feedback')
            .delete()
            .eq('id', feedbackId);

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        const errorMessage = getErrorMessage(error);
        console.error('Error deleting feedback:', errorMessage, error);
        return { data: null, error: { message: errorMessage, ...error } };
    }
};
