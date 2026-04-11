import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

/**
 * useAuth Hook
 * Custom hook to access authentication context
 * Usage: const { user, isAuthenticated, handleLogout } = useAuth();
 */
export const useAuth = () => {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }

    return context;
};

export default useAuth;
