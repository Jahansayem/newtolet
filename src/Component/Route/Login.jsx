import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { loginUser } from '../../services/authService';
import { buildDashboardHref, buildPageHref, canonicalizeInternalHref } from '../../lib/routePaths.js';
import { useAuth } from '../../hooks/useAuth';
import './Login.css';

const AUTH_ROUTE_PREFIXES = ['/login', '/registration', '/forgot-password', '/reset-password'];

const resolveRedirectTarget = (locationState) => {
    const fallbackHref = buildDashboardHref();
    const from = locationState?.from;

    if (!from) {
        return fallbackHref;
    }

    const rawTarget =
        typeof from === 'string'
            ? from
            : from.href || `${from.pathname || ''}${from.search || ''}${from.hash || ''}`;

    if (!rawTarget) {
        return fallbackHref;
    }

    const targetHref = canonicalizeInternalHref(rawTarget);

    if (
        typeof targetHref !== 'string' ||
        !targetHref.startsWith('/') ||
        AUTH_ROUTE_PREFIXES.some((routePrefix) => targetHref.startsWith(routePrefix))
    ) {
        return fallbackHref;
    }

    return targetHref;
};

const Login = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, isLoading: isAuthLoading, handleLogin } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [allowRenderWhileAuthPending, setAllowRenderWhileAuthPending] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const redirectTarget = useMemo(() => resolveRedirectTarget(location.state), [location.state]);

    // Check for password reset success in URL params
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        if (params.get('reset') === 'success') {
            setSuccessMessage('Password reset successful! Please login with your new password.');
            // Clear the URL parameter
            window.history.replaceState({}, '', buildPageHref('login'));
        }
    }, [location.search]);

    useEffect(() => {
        if (!isAuthLoading && isAuthenticated) {
            navigate(redirectTarget, { replace: true });
        }
    }, [isAuthLoading, isAuthenticated, navigate, redirectTarget]);

    useEffect(() => {
        if (!isAuthLoading) {
            setAllowRenderWhileAuthPending(false);
            return undefined;
        }

        const timeoutId = window.setTimeout(() => {
            setAllowRenderWhileAuthPending(true);
        }, 2500);

        return () => window.clearTimeout(timeoutId);
    }, [isAuthLoading]);

    const {
        register,
        formState: { errors },
        handleSubmit,
    } = useForm();

    const onSubmit = async (data) => {
        setIsLoading(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const result = await loginUser(data.email, data.password);

            if (result.success) {
                handleLogin(result.user, result.session);
                navigate(redirectTarget, { replace: true });
            } else {
                setErrorMessage(result.error);
            }
        } catch (error) {
            setErrorMessage('Login failed. Please try again.');
            console.error('Login error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    if ((isAuthLoading && !allowRenderWhileAuthPending) || isAuthenticated) {
        return (
            <div className='auth-shell min-h-screen justify-center'>
                <span className='loading loading-spinner loading-xl text-[#1E73B8]'></span>
            </div>
        );
    }

    return (
        <div className='auth-shell'>
            {/* Animated Wave Background */}
            <div className='absolute inset-0 overflow-hidden'>
                <svg className='absolute w-full h-full' xmlns='http://www.w3.org/2000/svg'>
                    <defs>
                        <linearGradient id='wave-gradient' x1='0%' y1='0%' x2='100%' y2='100%'>
                            <stop offset='0%' style={{stopColor: '#1E73B8', stopOpacity: 0.1}} />
                            <stop offset='50%' style={{stopColor: '#42a5f5', stopOpacity: 0.15}} />
                            <stop offset='100%' style={{stopColor: '#1E73B8', stopOpacity: 0.1}} />
                        </linearGradient>
                    </defs>
                    <path className='wave-path wave-1' fill='url(#wave-gradient)' d='M0,160 C320,300,420,300,740,160 C1060,20,1120,20,1920,160 L1920,0 L0,0 Z' />
                    <path className='wave-path wave-2' fill='url(#wave-gradient)' d='M0,100 C360,250,460,250,800,100 C1140,-50,1200,-50,1920,100 L1920,0 L0,0 Z' opacity='0.5' />
                </svg>
            </div>

            {/* Animated Dots Pattern */}
            <div className='absolute inset-0 opacity-30'>
                <div className='dots-pattern'></div>
            </div>

            {/* Geometric Shapes */}
            <div className='absolute top-20 right-10 w-20 h-20 border-4 border-[#1E73B8] opacity-20 rotate-45 animate-spin-slow'></div>
            <div className='absolute bottom-32 left-16 w-16 h-16 bg-[#1E73B8] opacity-10 rounded-full animate-pulse-slow'></div>
            <div className='absolute top-1/3 left-1/4 w-12 h-12 border-4 border-[#42a5f5] opacity-15 animate-bounce-slow'></div>

            <form onSubmit={handleSubmit(onSubmit)} className='auth-form-shell'>
                <div className='auth-card login-card-border text-sm'>
                <p className='auth-title'>Login Here</p>
                <p className='auth-subtitle'>Access saved listings, your dashboard, and property activity in one place.</p>

                {successMessage && (
                    <div className='auth-message auth-message-success'>
                        {successMessage}
                    </div>
                )}

                {errorMessage && (
                    <div className='auth-message auth-message-error'>
                        {errorMessage}
                    </div>
                )}

                <div className='w-full'>
                    <p className='auth-label'>Email</p>
                    <input
                        type="email"
                        placeholder='Email'
                        {...register("email", {
                            required: "Email is required",
                            pattern: {
                                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                message: "Invalid email address"
                            }
                        })}
                        className='auth-input my-2'
                        disabled={isLoading}
                    />
                    {errors.email && <p className='text-red-700 text-xs'>{errors.email.message}</p>}
                </div>

                <div className='w-full'>
                    <p className='auth-label'>Password</p>
                    <input
                        type="password"
                        placeholder='Password'
                        {...register("password", {
                            required: "Password is required",
                            minLength: {
                                value: 6,
                                message: "Password must be at least 6 characters"
                            }
                        })}
                        className='auth-input my-2'
                        disabled={isLoading}
                    />
                    {errors.password && <p className='text-red-700 text-xs'>{errors.password.message}</p>}
                </div>

                <button
                    type="submit"
                    className='auth-submit disabled:cursor-not-allowed disabled:opacity-50'
                    disabled={isLoading}
                >
                    {isLoading ? "Logging in..." : "Login"}
                </button>

                <div className='w-full space-y-2 pt-2 text-center'>
                    <p>
                        Create a new account? <Link to='/registration' className='text-[#1E73B8] font-medium cursor-pointer hover:underline'>Register here</Link>
                    </p>
                    <p className='pt-1'>
                        <Link to='/forgot-password' className='text-[#1E73B8] font-semibold cursor-pointer hover:underline text-sm inline-block border-b border-transparent hover:border-[#1E73B8] pb-0.5 transition-all'>Forgot password?</Link>
                    </p>
                </div>
            </div>
            </form>
        </div>
    );
};

export default Login;
