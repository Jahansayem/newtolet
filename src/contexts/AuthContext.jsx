import React, { createContext, useState, useEffect, useCallback, useRef } from 'react';
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
    const syncRequestRef = useRef(null);

    const applyAuthState = useCallback((nextUser, nextSession) => {
        setSession(nextSession || null);
        setUser(nextUser || null);
        setIsAuthenticated(Boolean(nextUser));
    }, []);

    const syncAuthState = useCallback(async ({ sessionOverride, userOverride } = {}) => {
        const nextSession = sessionOverride === undefined ? await getSession() : sessionOverride;
        const syncKey = nextSession?.access_token || nextSession?.user?.id || 'anonymous';

        if (syncRequestRef.current?.key === syncKey) {
            return syncRequestRef.current.promise;
        }

        const syncPromise = (async () => {
            try {
                if (!nextSession?.user) {
                    applyAuthState(null, null);
                    return null;
                }

                const fallbackUser = userOverride || getStoredUser();

                if (fallbackUser?.id === nextSession.user.id) {
                    applyAuthState(fallbackUser, nextSession);
                    return fallbackUser;
                }

                const currentUser = await getCurrentUser();
                const resolvedUser = currentUser || null;

                applyAuthState(resolvedUser, nextSession);
                return resolvedUser;
            } catch (error) {
                console.error('Error syncing auth state:', error);
                applyAuthState(null, null);
                return null;
            } finally {
                if (syncRequestRef.current?.key === syncKey) {
                    syncRequestRef.current = null;
                }
            }
        })();

        syncRequestRef.current = {
            key: syncKey,
            promise: syncPromise
        };

        return syncPromise;
    }, [applyAuthState]);

    useEffect(() => {
        let isMounted = true;

        const initializeAuth = async () => {
            try {
                const storedUser = getStoredUser();
                if (storedUser && isMounted) {
                    applyAuthState(storedUser, null);
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
            const storedUser = getStoredUser();
            const userOverride = storedUser?.id === nextSession?.user?.id ? storedUser : null;

            void syncAuthState({ sessionOverride: nextSession, userOverride }).finally(() => {
                if (isMounted) {
                    setIsLoading(false);
                }
            });
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, [applyAuthState, syncAuthState]);

    // Handle logout
    const handleLogout = useCallback(async () => {
        try {
            await logoutUser();
            applyAuthState(null, null);
        } catch (error) {
            console.error('Error during logout:', error);
        }
    }, [applyAuthState]);

    // Handle login (called from Login component)
    const handleLogin = useCallback((userData, sessionData) => {
        applyAuthState(userData, sessionData);
    }, [applyAuthState]);

    // Handle registration (called from Registration component)
    const handleRegistration = useCallback(() => {
        // Registration doesn't auto-login user, they need to verify email first
        applyAuthState(null, null);
    }, [applyAuthState]);

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
