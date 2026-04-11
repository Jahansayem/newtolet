import { supabase } from './supabaseClient';
import { readSnapshot, writeSnapshot } from './cacheService';

export const getApprovedFeedbackCacheKey = () => 'feedback:approved';

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
        console.error('Error submitting feedback:', error);
        return { data: null, error };
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
        console.error('Error fetching feedback:', error);
        return { data: null, error };
    }
};

/**
 * Get approved feedback (for public display)
 * @returns {Promise<{data: Array|null, error: Object|null}>}
 */
export const getApprovedFeedback = async () => {
    const cacheKey = getApprovedFeedbackCacheKey();

    try {
        const { data, error } = await supabase
            .from('feedback')
            .select('*')
            .eq('status', 'approved')
            .order('created_at', { ascending: false });

        if (error) throw error;
        const approvedFeedback = data || [];
        writeSnapshot(cacheKey, approvedFeedback);
        return { data: approvedFeedback, error: null };
    } catch (error) {
        console.error('Error fetching approved feedback:', error);

        const cachedFeedback = readSnapshot(cacheKey);
        if (cachedFeedback) {
            console.warn('Using cached approved feedback after fetch error');
            return { data: cachedFeedback, error: null };
        }

        return { data: null, error };
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
        console.error('Error updating feedback status:', error);
        return { data: null, error };
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
        console.error('Error deleting feedback:', error);
        return { data: null, error };
    }
};
