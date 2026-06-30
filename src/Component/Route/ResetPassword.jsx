import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { resetPassword } from '../../services/authService';
import { supabase } from '../../services/supabaseClient';
import './Login.css';

const ResetPassword = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [isRecoveryMode, setIsRecoveryMode] = useState(false);
    const [isCheckingSession, setIsCheckingSession] = useState(true);
    const isMountedRef = useRef(true);
    const redirectTimerRef = useRef(null);

    // Cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
            if (redirectTimerRef.current) {
                clearTimeout(redirectTimerRef.current);
            }
        };
    }, []);

    const {
        register,
        formState: { errors },
        handleSubmit,
        watch,
    } = useForm();

    const newPassword = watch('newPassword');

    // Check if we're in password recovery mode on component mount
    useEffect(() => {
        const checkRecoverySession = async () => {
            // SSR guard
            if (typeof window === 'undefined') {
                return
            }

            try {
                console.log('🔍 Checking for password recovery session...');
                console.log('📍 Current URL:', window.location.href);
                console.log('📍 Hash:', location.hash);
                console.log('📍 Search:', location.search);

                // Parse URL hash for recovery tokens (Supabase puts tokens in hash)
                const hash = location.hash.substring(1); // Remove the #
                const hashParams = new URLSearchParams(hash);

                const accessToken = hashParams.get('access_token');
                const refreshToken = hashParams.get('refresh_token');
                const type = hashParams.get('type');

                console.log('📋 Hash Params:', {
                    hasAccessToken: !!accessToken,
                    hasRefreshToken: !!refreshToken,
                    type: type,
                    hash: hash.substring(0, 100) // First 100 chars
                });

                // Method 1: Check for tokens in hash (normal Supabase flow)
                if (accessToken && refreshToken && type === 'recovery') {
                    console.log('✅ Recovery link detected in hash!');

                    // Set the session using the tokens from the URL
                    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                        access_token: accessToken,
                        refresh_token: refreshToken,
                    });

                    if (sessionError) {
                        console.error('❌ Session error:', sessionError);
                        if (isMountedRef.current) {
                            setErrorMessage(
                                'Invalid or expired reset link. The link may have been used already or has expired (links expire in 1 hour). Please request a new password reset.'
                            );
                        }
                        return;
                    }

                    console.log('✅ Session set successfully:', sessionData.session?.user?.email);
                    if (isMountedRef.current) {
                        setIsRecoveryMode(true);
                    }
                    return;
                }

                // Method 2: Check for tokens in query params (fallback for some mobile browsers)
                const searchParams = new URLSearchParams(location.search);
                const queryAccessToken = searchParams.get('access_token');
                const queryRefreshToken = searchParams.get('refresh_token');
                const queryType = searchParams.get('type');

                if (queryAccessToken && queryRefreshToken && queryType === 'recovery') {
                    console.log('✅ Recovery link detected in query params (mobile fallback)!');

                    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
                        access_token: queryAccessToken,
                        refresh_token: queryRefreshToken,
                    });

                    if (sessionError) {
                        console.error('❌ Session error:', sessionError);
                        if (isMountedRef.current) {
                            setErrorMessage('Invalid or expired reset link. Please request a new password reset.');
                        }
                        return;
                    }

                    console.log('✅ Session set successfully:', sessionData.session?.user?.email);
                    if (isMountedRef.current) {
                        setIsRecoveryMode(true);
                    }
                    return;
                }

                // Method 3: Check if user is already logged in (allow password change)
                console.log('📧 Checking for existing session...');
                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    console.log('✅ User logged in:', session.user?.email);
                    if (isMountedRef.current) {
                        setIsRecoveryMode(true);
                    }
                    return;
                }

                // No valid recovery method found
                console.warn('❌ No recovery session found');
                console.warn('Full URL details:', {
                    href: window.location.href,
                    hash: location.hash,
                    search: location.search,
                    pathname: location.pathname
                });

                if (isMountedRef.current) {
                    setErrorMessage(
                        'Invalid or expired password reset link. Please request a new password reset.'
                    );
                }

            } catch (error) {
                console.error('❌ Error checking recovery session:', error);
                if (isMountedRef.current) {
                    setErrorMessage(
                        'Failed to verify reset link. Please request a new password reset.'
                    );
                }
            } finally {
                if (isMountedRef.current) {
                    setIsCheckingSession(false);
                }
            }
        };

        checkRecoverySession();
    }, [location.hash, location.pathname, location.search]);

    const onSubmit = async (data) => {
        // Prevent submission if not in recovery mode
        if (!isRecoveryMode) {
            setErrorMessage('Invalid password reset session. Please request a new reset link.');
            return;
        }

        setIsLoading(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const result = await resetPassword(data.newPassword);

            if (result.success) {
                if (isMountedRef.current) {
                    setSuccessMessage(result.message);
                }

                // Redirect to login after 1.5 seconds
                redirectTimerRef.current = setTimeout(() => {
                    if (isMountedRef.current) {
                        navigate('/login?reset=success', { replace: true });
                    }
                }, 1500);
            } else {
                if (isMountedRef.current) {
                    setErrorMessage(result.error);
                }
            }
        } catch (error) {
            if (isMountedRef.current) {
                setErrorMessage('Failed to reset password. Please try again.');
            }
            console.error('Password reset error:', error);
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    };

    // Show loading state while checking session
    if (isCheckingSession) {
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

                <div className='auth-form-shell'>
                    <div className='auth-card login-card-border text-sm'>
                        <p className='auth-title'>Verifying Reset Link...</p>
                        <div className='w-full flex justify-center py-8'>
                            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E73B8]'></div>
                        </div>
                    </div>
                </div>
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
                    <p className='auth-title'>Reset Password</p>
                <p className='auth-subtitle'>
                    Enter your new password below.
                </p>

                {/* Error Message */}
                {errorMessage && (
                    <div className='auth-message auth-message-error'>
                        <p className='font-medium'>Error</p>
                        <p className='text-xs mt-1'>{errorMessage}</p>
                        {!isRecoveryMode && (
                            <Link
                                to='/forgot-password'
                                className='text-xs underline mt-2 inline-block hover:text-red-900'
                            >
                                Request a new reset link
                            </Link>
                        )}
                    </div>
                )}

                {/* Success Message */}
                {successMessage && (
                    <div className='auth-message auth-message-success'>
                        <p className='font-medium'>Success!</p>
                        <p className='text-xs mt-1'>{successMessage}</p>
                        <p className='text-xs mt-2'>Redirecting to login...</p>
                    </div>
                )}

                {/* Only show form if in recovery mode */}
                {isRecoveryMode && !successMessage && (
                    <>
                        <div className='w-full'>
                            <p className='auth-label'>New Password</p>
                            <input
                                type="password"
                                placeholder='Enter new password'
                                {...register("newPassword", {
                                    required: "New password is required",
                                    minLength: {
                                        value: 6,
                                        message: "Password must be at least 6 characters"
                                    }
                                })}
                                className='auth-input my-2'
                                disabled={isLoading}
                            />
                            {errors.newPassword && <p className='text-red-700 text-xs'>{errors.newPassword.message}</p>}
                        </div>

                        <div className='w-full'>
                            <p className='auth-label'>Confirm New Password</p>
                            <input
                                type="password"
                                placeholder='Confirm new password'
                                {...register("confirmPassword", {
                                    required: "Please confirm your password",
                                    validate: (value) =>
                                        value === newPassword || "Passwords do not match"
                                })}
                                className='auth-input my-2'
                                disabled={isLoading}
                            />
                            {errors.confirmPassword && <p className='text-red-700 text-xs'>{errors.confirmPassword.message}</p>}
                        </div>

                        <button
                            type="submit"
                            className='auth-submit disabled:cursor-not-allowed disabled:opacity-50'
                            disabled={isLoading}
                        >
                            {isLoading ? "Resetting..." : "Reset Password"}
                        </button>
                    </>
                )}

                <div className='w-full text-center space-y-2'>
                    <p>
                        Remember your password? <Link to='/login' className='text-[#1E73B8] font-medium cursor-pointer hover:underline'>Login</Link>
                    </p>
                </div>
            </div>
            </form>
        </div>
    );
};

export default ResetPassword;
