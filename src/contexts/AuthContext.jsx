import React, { createContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
    const isMountedRef = useRef(true);
    const lastSessionTokenRef = useRef(null); // Use ref to prevent stale closure issues

    // Direct state setter - not a useCallback to avoid dependency issues
    const applyAuthState = useCallback((nextUser, nextSession) => {
        if (!isMountedRef.current) return;

        setSession(nextSession || null);
        setUser(nextUser || null);
        setIsAuthenticated(Boolean(nextUser));
    }, []);

    // Sync auth state - memoized with minimal dependencies
    const syncAuthState = useCallback(async ({ sessionOverride, userOverride } = {}) => {
        if (!isMountedRef.current) return null;

        const nextSession = sessionOverride === undefined ? await getSession() : sessionOverride;
        const syncKey = nextSession?.access_token || nextSession?.user?.id || 'anonymous';

        // Prevent duplicate concurrent requests
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
        isMountedRef.current = true;

        // Track if initial loading is complete to prevent flicker
        let initialLoadComplete = false;

        const initializeAuth = async () => {
            try {
                const storedUser = getStoredUser();
                if (storedUser && isMountedRef.current) {
                    applyAuthState(storedUser, null);
                }

                await syncAuthState();
            } catch (error) {
                console.error('Error initializing auth:', error);
            } finally {
                if (isMountedRef.current && !initialLoadComplete) {
                    setIsLoading(false);
                    initialLoadComplete = true;
                }
            }
        };

        initializeAuth();

        // Supabase auth state change listener
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
            if (!isMountedRef.current) return;

            // Extract the access token to compare sessions
            const sessionToken = nextSession?.access_token;

            // Skip if this is the same session (prevents duplicate processing)
            // Use ref to properly track across callback invocations
            if (sessionToken === lastSessionTokenRef.current) {
                return;
            }

            // Only process specific auth events that actually change the session
            if (event !== 'INITIAL_SESSION' && event !== 'SIGNED_IN' && event !== 'SIGNED_OUT') {
                // For TOKEN_REFRESHED, we can just update the session without full sync
                if (event === 'TOKEN_REFRESHED' && nextSession) {
                    // Just update session state without refetching user
                    const storedUser = getStoredUser();
                    if (storedUser?.id === nextSession.user?.id) {
                        setSession(nextSession);
                        lastSessionTokenRef.current = sessionToken; // Update ref
                        return;
                    }
                }
            }

            // Update ref before processing
            lastSessionTokenRef.current = sessionToken;

            const storedUser = getStoredUser();
            const userOverride = storedUser?.id === nextSession?.user?.id ? storedUser : null;

            // Only update loading state for initial session, not for subsequent changes
            if (!initialLoadComplete) {
                void syncAuthState({ sessionOverride: nextSession, userOverride }).finally(() => {
                    if (isMountedRef.current && !initialLoadComplete) {
                        setIsLoading(false);
                        initialLoadComplete = true;
                    }
                });
            } else {
                // For subsequent auth changes, sync without affecting loading state
                void syncAuthState({ sessionOverride: nextSession, userOverride });
            }
        });

        return () => {
            isMountedRef.current = false;
            subscription.unsubscribe();
            syncRequestRef.current = null;
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Handle logout
    const handleLogout = useCallback(async () => {
        try {
            await logoutUser();
            applyAuthState(null, null);
            lastSessionTokenRef.current = null; // Reset on logout
        } catch (error) {
            console.error('Error during logout:', error);
        }
    }, [applyAuthState]);

    // Handle login (called from Login component)
    const handleLogin = useCallback((userData, sessionData) => {
        lastSessionTokenRef.current = sessionData?.access_token || null; // Update on login
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

    // Memoize the context value to prevent unnecessary re-renders
    const value = useMemo(() => ({
        user,
        session,
        isAuthenticated,
        isLoading,
        handleLogin,
        handleLogout,
        handleRegistration,
        updateUserInContext
    }), [user, session, isAuthenticated, isLoading, handleLogin, handleLogout, handleRegistration, updateUserInContext]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
