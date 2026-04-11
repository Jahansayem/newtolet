import { supabase } from './supabaseClient';
import {
    buildUserPanelCacheKey,
    invalidateUserPanelCache,
    revalidateUserPanelResource,
} from './cacheService';
import { serializeOrderPreferences } from '../utils/orderPreferences';
import { getUserPanelCachePolicy } from './userPanelCacheConfig';

// Single package: 7 Days Only - 1000 BDT
const ORDER_COST = 1000;
export const getUserOrdersCacheKey = (userId) => `orders:user:${userId || 'anonymous'}`;
const getUserPanelOrdersCacheKey = (userId) => buildUserPanelCacheKey(userId || 'guest', 'orders')

const getPrimaryLocation = (orderData) => {
    if (Array.isArray(orderData.locations) && orderData.locations.length > 0) {
        return orderData.locations[0] || {};
    }

    return orderData;
};

const normalizeOrderDate = (value) => {
    if (!value) {
        return null;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toISOString().slice(0, 10);
};

/**
 * Create a new property order/requirement
 * @param {Object} orderData - The order data
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const createOrder = async (orderData) => {
    try {
        const primaryLocation = getPrimaryLocation(orderData);
        const insertData = {
            user_id: orderData.userId,
            division: primaryLocation.division,
            district: primaryLocation.district,
            area: primaryLocation.area,
            category: orderData.category,
            rooms: parseInt(orderData.rooms) || 1,
            property_need_from: normalizeOrderDate(orderData.propertyNeedFrom),
            max_budget: orderData.maxBudget ? parseInt(orderData.maxBudget) : null,
            additional_preferences: serializeOrderPreferences(orderData),
            package: '7_days',
            cost: ORDER_COST,
            status: 'pending_payment'
        };

        // Log for debugging
        console.log('Creating order with data:', insertData);

        const { data, error } = await supabase
            .from('orders')
            .insert(insertData)
            .select()
            .single();

        if (error) throw error;
        invalidateUserPanelCache(getUserPanelOrdersCacheKey(orderData.userId))
        invalidateUserPanelCache(buildUserPanelCacheKey(orderData.userId || 'guest', 'dashboard'))
        return { data, error: null };
    } catch (error) {
        console.error('Error creating order:', error);
        return { data: null, error };
    }
};

/**
 * Update order status after payment
 * @param {string} orderId - The order ID
 * @param {string} status - New status ('confirmed', 'cancelled', etc.)
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const updateOrderStatus = async (orderId, status) => {
    try {
        const { data, error } = await supabase
            .from('orders')
            .update({
                status,
                updated_at: new Date().toISOString()
            })
            .eq('id', orderId)
            .select()
            .single();

        if (error) throw error;
        if (data?.user_id) {
            invalidateUserPanelCache(getUserPanelOrdersCacheKey(data.user_id))
            invalidateUserPanelCache(buildUserPanelCacheKey(data.user_id, 'dashboard'))
        }

        invalidateUserPanelCache(buildUserPanelCacheKey('global', 'job-feed'))
        return { data, error: null };
    } catch (error) {
        console.error('Error updating order status:', error);
        return { data: null, error };
    }
};

/**
 * Get order by ID
 * @param {string} orderId - The order ID
 * @returns {Promise<{data: Object|null, error: Object|null}>}
 */
export const getOrderById = async (orderId) => {
    try {
        const { data, error } = await supabase
            .from('orders')
            .select('*')
            .eq('id', orderId)
            .single();

        if (error) throw error;
        return { data, error: null };
    } catch (error) {
        console.error('Error fetching order:', error);
        return { data: null, error };
    }
};

/**
 * Get all orders for a user
 * @param {string} userId - The user ID
 * @returns {Promise<{data: Array|null, error: Object|null}>}
 */
export const getUserOrders = async (userId) => {
    const cacheKey = getUserPanelOrdersCacheKey(userId);

    try {
        const entry = await revalidateUserPanelResource({
            cacheKey,
            policy: getUserPanelCachePolicy('orders'),
            fetcher: async () => {
                const { data, error } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false });

                if (error) throw error;
                return data || [];
            },
        })

        const userOrders = entry?.data || [];
        return { data: userOrders, error: null };
    } catch (error) {
        console.error('Error fetching user orders:', error);
        return { data: null, error };
    }
};

/**
 * Get the fixed order cost
 * @returns {number}
 */
export const getOrderCost = () => ORDER_COST;

/**
 * Validate order data before submission
 * @param {Object} orderData - The order data to validate
 * @returns {{isValid: boolean, errors: Object}}
 */
export const validateOrderData = (orderData) => {
    const errors = {};
    const primaryLocation = getPrimaryLocation(orderData);

    if (!primaryLocation.division) {
        errors.division = 'Division is required';
    }
    if (!primaryLocation.district) {
        errors.district = 'District is required';
    }
    if (!primaryLocation.area) {
        errors.area = 'Area is required';
    }
    if (!orderData.category) {
        errors.category = 'Category is required';
    }
    if (!orderData.gender) {
        errors.gender = 'Gender is required';
    }
    if (!orderData.rooms) {
        errors.rooms = 'Number of rooms is required';
    }
    if (!orderData.propertyNeedFrom) {
        errors.propertyNeedFrom = 'Need from date is required';
    }
    if (!orderData.maxBudget) {
        errors.maxBudget = 'Maximum total budget is required';
    }
    if (!orderData.agreedToTerms) {
        errors.agreedToTerms = 'You must agree to the terms and conditions';
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
};
