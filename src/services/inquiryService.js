import { supabase } from './supabaseClient';

/**
 * Create a new property inquiry from contact form
 * @param {Object} inquiryData - The inquiry data
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const createPropertyInquiry = async (inquiryData) => {
    try {
        const { data, error } = await supabase
            .from('property_inquiries')
            .insert({
                property_id: inquiryData.propertyId,
                name: inquiryData.name,
                email: inquiryData.email,
                phone: inquiryData.phone,
                message: inquiryData.message,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('Error creating property inquiry:', error);
        return { data: null, error };
    }
};

/**
 * Get all inquiries for a specific property (for property owners)
 * @param {string} propertyId - The property ID
 * @returns {Promise<{data: Array|null, error: Object|null}>}
 */
export const getPropertyInquiries = async (propertyId) => {
    try {
        const { data, error } = await supabase
            .from('property_inquiries')
            .select('*')
            .eq('property_id', propertyId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('Error fetching property inquiries:', error);
        return { data: null, error };
    }
};

/**
 * Get all inquiries (for admin)
 * @returns {Promise<{data: Array|null, error: Object|null}>}
 */
export const getAllInquiries = async () => {
    try {
        const { data, error } = await supabase
            .from('property_inquiries')
            .select(`
                *,
                properties (
                    id,
                    category,
                    area,
                    state_district
                )
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('Error fetching all inquiries:', error);
        return { data: null, error };
    }
};

/**
 * Update inquiry status
 * @param {string} inquiryId - The inquiry ID
 * @param {string} status - New status ('pending', 'contacted', 'resolved', 'closed')
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const updateInquiryStatus = async (inquiryId, status) => {
    try {
        const { data, error } = await supabase
            .from('property_inquiries')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', inquiryId)
            .select()
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('Error updating inquiry status:', error);
        return { data: null, error };
    }
};

/**
 * Delete an inquiry
 * @param {string} inquiryId - The inquiry ID
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const deleteInquiry = async (inquiryId) => {
    try {
        const { data, error } = await supabase
            .from('property_inquiries')
            .delete()
            .eq('id', inquiryId);

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('Error deleting inquiry:', error);
        return { data: null, error };
    }
};
