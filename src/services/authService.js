import { supabase } from './supabaseClient';
import { clearUserPanelCache } from './cacheService';

/**
 * Authentication Service
 * Handles user registration, login, logout, and session management with Supabase
 */

// ============================================================================
// USER REGISTRATION
// ============================================================================

export const registerUser = async (name, email, password) => {
    try {
        // Validate inputs
        if (!name || !email || !password) {
            throw new Error('All fields are required');
        }

        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }

        if (password.length > 20) {
            throw new Error('Password must be less than 20 characters');
        }

        // Create user in Supabase Auth
        // Note: Supabase Auth handles duplicate email check automatically
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    name: name,
                }
            }
        });

        if (authError) {
            throw new Error(authError.message || 'Registration failed');
        }

        // Create user profile in users table
        const { data: userData, error: userError } = await supabase
            .from('users')
            .insert([
                {
                    id: authData.user.id,
                    name: name,
                    email: email,
                    credits: 0,
                    verified: false
                }
            ])
            .select()
            .single();

        if (userError) {
            // Clean up auth user if profile creation fails
            await supabase.auth.admin.deleteUser(authData.user.id);
            throw new Error('Failed to create user profile');
        }

        return {
            success: true,
            user: userData,
            message: 'Registration successful! Please check your email to verify your account.'
        };

    } catch (error) {
        return {
            success: false,
            error: error.message || 'Registration failed',
            user: null
        };
    }
};

// ============================================================================
// USER LOGIN
// ============================================================================

export const loginUser = async (email, password) => {
    try {
        // Validate inputs
        if (!email || !password) {
            throw new Error('Email and password are required');
        }

        // Sign in with Supabase Auth
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });

        if (authError) {
            throw new Error(authError.message || 'Login failed');
        }

        if (!authData.user) {
            throw new Error('Login failed - no user returned');
        }

        // Get user profile
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        if (userError) {
            throw new Error('Failed to fetch user profile');
        }

        // Store user in localStorage
        localStorage.setItem('user', JSON.stringify({
            id: userData.id,
            name: userData.name,
            email: userData.email,
            credits: userData.credits,
            verified: userData.verified,
            phone: userData.phone,
            referral_username: userData.referral_username,
            referral_code: userData.referral_code,
            referred_by: userData.referred_by,
            is_admin: userData.is_admin,
            is_active: userData.is_active
        }));

        // Store auth token
        localStorage.setItem('authToken', authData.session.access_token);

        // Dispatch custom event to notify components (like Navbar) that login is complete
        window.dispatchEvent(new Event('userLogin'));

        return {
            success: true,
            user: userData,
            session: authData.session,
            message: 'Login successful!'
        };

    } catch (error) {
        return {
            success: false,
            error: error.message || 'Login failed',
            user: null,
            session: null
        };
    }
};

// ============================================================================
// USER LOGOUT
// ============================================================================

export const logoutUser = async () => {
    try {
        const storedUser = getStoredUser();

        // Sign out from Supabase
        const { error } = await supabase.auth.signOut();

        if (error) {
            throw new Error(error.message || 'Logout failed');
        }

        // Clear localStorage
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
        clearUserPanelCache(storedUser?.id);

        // Dispatch custom event to notify components (like Navbar) that logout is complete
        window.dispatchEvent(new Event('userLogout'));

        return {
            success: true,
            message: 'Logout successful'
        };

    } catch (error) {
        return {
            success: false,
            error: error.message || 'Logout failed'
        };
    }
};

// ============================================================================
// SESSION MANAGEMENT
// ============================================================================

export const getCurrentUser = async () => {
    try {
        const { data: authData, error } = await supabase.auth.getUser();

        if (error || !authData.user) {
            return null;
        }

        // Get user profile
        const { data: userData } = await supabase
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        return userData || null;

    } catch (error) {
        console.error('Error fetching current user:', error);
        return null;
    }
};

export const getSession = async () => {
    try {
        const { data: sessionData, error } = await supabase.auth.getSession();

        if (error) {
            throw new Error(error.message);
        }

        return sessionData.session;

    } catch (error) {
        console.error('Error fetching session:', error);
        return null;
    }
};

// ============================================================================
// PASSWORD RESET
// ============================================================================

export const requestPasswordReset = async (email) => {
    try {
        if (!email) {
            throw new Error('Email is required');
        }

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) {
            throw new Error(error.message || 'Failed to send reset email');
        }

        return {
            success: true,
            message: 'Password reset link sent to your email'
        };

    } catch (error) {
        return {
            success: false,
            error: error.message || 'Failed to request password reset'
        };
    }
};

export const resetPassword = async (password) => {
    try {
        if (!password) {
            throw new Error('New password is required');
        }

        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }

        const storedUser = getStoredUser();

        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
            throw new Error(error.message || 'Failed to reset password');
        }

        // Clear localStorage after password reset
        localStorage.removeItem('user');
        localStorage.removeItem('authToken');
        clearUserPanelCache(storedUser?.id);

        return {
            success: true,
            message: 'Password reset successful! Please login with your new password.'
        };

    } catch (error) {
        return {
            success: false,
            error: error.message || 'Failed to reset password'
        };
    }
};

// ============================================================================
// USER PROFILE MANAGEMENT
// ============================================================================

export const updateUserProfile = async (userId, updates) => {
    try {
        if (!userId) {
            throw new Error('User ID is required');
        }

        const { data, error } = await supabase
            .from('users')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            throw new Error(error.message || 'Failed to update profile');
        }

        // Update localStorage
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        localStorage.setItem('user', JSON.stringify({
            ...currentUser,
            ...updates
        }));

        return {
            success: true,
            user: data,
            message: 'Profile updated successfully'
        };

    } catch (error) {
        return {
            success: false,
            error: error.message || 'Failed to update profile',
            user: null
        };
    }
};

export const getUserById = async (userId) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();

        if (error) {
            throw new Error(error.message || 'Failed to fetch user');
        }

        return {
            success: true,
            user: data
        };

    } catch (error) {
        return {
            success: false,
            error: error.message || 'Failed to fetch user',
            user: null
        };
    }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export const isUserAuthenticated = () => {
    if (typeof window === 'undefined') {
        return false;
    }

    const user = localStorage.getItem('user');
    const token = localStorage.getItem('authToken');
    return !!(user && token);
};

export const getStoredUser = () => {
    if (typeof window === 'undefined') {
        return null;
    }

    try {
        const user = localStorage.getItem('user');
        return user ? JSON.parse(user) : null;
    } catch (error) {
        console.error('Error parsing stored user:', error);
        return null;
    }
};

export const isUserAdmin = () => {
    const user = getStoredUser();
    return user?.is_admin === true;
};

export const addCreditsToUser = async (userId, credits) => {
    try {
        if (!userId || credits <= 0) {
            throw new Error('Invalid user ID or credits amount');
        }

        const { data: currentUser } = await supabase
            .from('users')
            .select('credits')
            .eq('id', userId)
            .single();

        const newCredits = (currentUser?.credits || 0) + credits;

        const { data, error } = await supabase
            .from('users')
            .update({
                credits: newCredits,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            throw new Error(error.message || 'Failed to add credits');
        }

        return {
            success: true,
            user: data,
            message: `${credits} credits added successfully`
        };

    } catch (error) {
        return {
            success: false,
            error: error.message || 'Failed to add credits',
            user: null
        };
    }
};

export const deductCreditsFromUser = async (userId, credits) => {
    try {
        if (!userId || credits <= 0) {
            throw new Error('Invalid user ID or credits amount');
        }

        const { data: currentUser } = await supabase
            .from('users')
            .select('credits')
            .eq('id', userId)
            .single();

        if ((currentUser?.credits || 0) < credits) {
            throw new Error('Insufficient credits');
        }

        const newCredits = (currentUser?.credits || 0) - credits;

        const { data, error } = await supabase
            .from('users')
            .update({
                credits: newCredits,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId)
            .select()
            .single();

        if (error) {
            throw new Error(error.message || 'Failed to deduct credits');
        }

        return {
            success: true,
            user: data,
            message: `${credits} credits deducted successfully`
        };

    } catch (error) {
        return {
            success: false,
            error: error.message || 'Failed to deduct credits',
            user: null
        };
    }
};

export default {
    registerUser,
    loginUser,
    logoutUser,
    getCurrentUser,
    getSession,
    requestPasswordReset,
    resetPassword,
    updateUserProfile,
    getUserById,
    isUserAuthenticated,
    getStoredUser,
    isUserAdmin,
    addCreditsToUser,
    deductCreditsFromUser
};
