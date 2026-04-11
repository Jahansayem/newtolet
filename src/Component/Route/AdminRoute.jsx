'use client';

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { buildPageHref } from '../../lib/routePaths.js';

const AdminRoute = ({ children }) => {
    const location = useLocation();
    const [isAdmin, setIsAdmin] = useState(false);
    const [hasUser, setHasUser] = useState(false);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        try {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
                const parsedUser = JSON.parse(storedUser);
                setHasUser(true);
                setIsAdmin(parsedUser.is_admin === true);
            }
        } catch (e) {
            console.error('Error parsing stored user:', e);
        }
        setChecked(true);
    }, []);

    if (!checked) {
        return null;
    }

    // Not logged in - redirect to login
    if (!hasUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Not logged in - redirect to login
    if (!hasUser) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Not admin - show access denied
    if (!isAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md text-center">
                    <div className="text-red-500 text-6xl mb-4">🚫</div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
                    <p className="text-gray-600 mb-6">
                        You don't have permission to access the admin panel. Only administrators can view this page.
                    </p>
                    <button
                        onClick={() => { window.location.href = buildPageHref() }}
                        className="bg-[#1E73B8] text-white px-6 py-2 rounded-lg hover:bg-[#1665a0] transition-colors"
                    >
                        Go to Homepage
                    </button>
                </div>
            </div>
        );
    }

    // Admin user - show content immediately
    return children;
};

export default AdminRoute;
