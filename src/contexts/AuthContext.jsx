import React, { createContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { getCurrentUser, getSession, logoutUser, getStoredUser } from '../services/authService';

/**
 * Authentication Context
 * Provides authentication state and functions to the entire app
 */
export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [session, setSession] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const syncAuthState = useCallback(async (sessionOverride = undefined) => {
        try {
            const nextSession = sessionOverride === undefined ? await getSession() : sessionOverride;
            const storedUser = getStoredUser();

            setSession(nextSession || null);

            if (!nextSession?.user) {
                setUser(null);
                setIsAuthenticated(false);
                return;
            }

            const currentUser = await getCurrentUser();
            const resolvedUser = currentUser || storedUser || null;

            setUser(resolvedUser);
            setIsAuthenticated(Boolean(resolvedUser));
        } catch (error) {
            console.error('Error syncing auth state:', error);
            setUser(null);
            setSession(null);
            setIsAuthenticated(false);
        }
    }, []);

    useEffect(() => {
        let isMounted = true;

        const initializeAuth = async () => {
            try {
                const storedUser = getStoredUser();
                if (storedUser && isMounted) {
                    setUser(storedUser);
                    setIsAuthenticated(true);
                }

                await syncAuthState();
            } finally {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
            void syncAuthState(nextSession).finally(() => {
                if (isMounted) {
                    setIsLoading(false);
                }
            });
        });

        const handleLocalAuthChange = () => {
            void syncAuthState().finally(() => {
                if (isMounted) {
                    setIsLoading(false);
                }
            });
        };

        window.addEventListener('userLogin', handleLocalAuthChange);
        window.addEventListener('userLogout', handleLocalAuthChange);

        return () => {
            isMounted = false;
            subscription.unsubscribe();
            window.removeEventListener('userLogin', handleLocalAuthChange);
            window.removeEventListener('userLogout', handleLocalAuthChange);
        };
    }, [syncAuthState]);

    // Handle logout
    const handleLogout = useCallback(async () => {
        try {
            await logoutUser();
            setUser(null);
            setSession(null);
            setIsAuthenticated(false);
        } catch (error) {
            console.error('Error during logout:', error);
        }
    }, []);

    // Handle login (called from Login component)
    const handleLogin = useCallback((userData, sessionData) => {
        setUser(userData);
        setSession(sessionData);
        setIsAuthenticated(true);
    }, []);

    // Handle registration (called from Registration component)
    const handleRegistration = useCallback(() => {
        // Registration doesn't auto-login user, they need to verify email first
        setUser(null);
        setSession(null);
        setIsAuthenticated(false);
    }, []);

    // Update user profile
    const updateUserInContext = useCallback((updatedUserData) => {
        setUser(prevUser => {
            const nextUser = {
                ...prevUser,
                ...updatedUserData
            };

            if (typeof window !== 'undefined') {
                localStorage.setItem('user', JSON.stringify(nextUser));
            }

            return nextUser;
        });
    }, []);

    const value = {
        user,
        session,
        isAuthenticated,
        isLoading,
        handleLogin,
        handleLogout,
        handleRegistration,
        updateUserInContext
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
