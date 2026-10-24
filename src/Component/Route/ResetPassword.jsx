import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { resetPassword } from '../../services/authService';
import { supabase } from '../../services/supabaseClient';
import { buildDashboardHref } from '../../lib/routePaths';
import { useLanguage } from '../../i18n/useLanguage';
import LanguageToggle from '../../components/LanguageToggle.jsx';
import PasswordInput from './PasswordInput.jsx';
import './Login.css';

// GoTrue reports a bad recovery link by redirecting back with
// #error=access_denied&error_code=otp_expired&error_description=...
// supabase-js leaves that hash in place, so we read it ourselves.
const readRecoveryParams = () => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const searchParams = new URLSearchParams(window.location.search);
    const pick = (key) => hashParams.get(key) || searchParams.get(key);

    return {
        error: pick('error'),
        errorCode: pick('error_code'),
        errorDescription: pick('error_description'),
        accessToken: pick('access_token'),
        refreshToken: pick('refresh_token'),
        type: pick('type'),
    };
};

const ResetPassword = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    // Translation key for errors raised while verifying the recovery session,
    // so the message follows the active language without re-running the check.
    const [errorKey, setErrorKey] = useState('');
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

    // Work out whether this page was opened from a valid recovery link.
    // Runs once on mount and reads window.location directly: the router shim's
    // location.hash is empty on the first render, and supabase-js (detectSessionInUrl)
    // may already have consumed a valid token hash by the time this effect runs.
    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        // The client emits PASSWORD_RECOVERY (or SIGNED_IN) once it has turned the
        // link's tokens into a session. Listening covers the case where that happens
        // after the checks below have already run.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (!isMountedRef.current || !session) return;
            if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
                setErrorKey('');
                setIsRecoveryMode(true);
                setIsCheckingSession(false);
            }
        });

        const checkRecoverySession = async () => {
            try {
                const params = readRecoveryParams();

                // 1. GoTrue rejected the link (expired, already used, malformed).
                if (params.error || params.errorCode || params.errorDescription) {
                    window.history.replaceState(window.history.state, '', window.location.pathname);
                    if (isMountedRef.current) {
                        setErrorKey(
                            params.errorCode === 'otp_expired'
                                ? 'auth.reset.errors.invalidLinkExpired'
                                : 'auth.reset.errors.invalidLink'
                        );
                    }
                    return;
                }

                // 2. Tokens still in the URL (hash normally; query on some mobile browsers).
                if (params.accessToken && params.refreshToken && params.type === 'recovery') {
                    const { error: sessionError } = await supabase.auth.setSession({
                        access_token: params.accessToken,
                        refresh_token: params.refreshToken,
                    });

                    if (sessionError) {
                        console.error('Password recovery session error:', sessionError);
                        if (isMountedRef.current) {
                            setErrorKey('auth.reset.errors.invalidLinkExpired');
                        }
                        return;
                    }

                    if (isMountedRef.current) {
                        setIsRecoveryMode(true);
                    }
                    return;
                }

                // 3. supabase-js already exchanged the link for a session (or the user is
                //    logged in). getSession() waits for that URL detection to finish.
                const { data: { session } } = await supabase.auth.getSession();

                if (session) {
                    if (isMountedRef.current) {
                        setIsRecoveryMode(true);
                    }
                    return;
                }

                if (isMountedRef.current) {
                    setErrorKey('auth.reset.errors.invalidResetLink');
                }
            } catch (error) {
                console.error('Error checking recovery session:', error);
                if (isMountedRef.current) {
                    setErrorKey('auth.reset.errors.verifyFailed');
                }
            } finally {
                if (isMountedRef.current) {
                    setIsCheckingSession(false);
                }
            }
        };

        checkRecoverySession();

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const onSubmit = async (data) => {
        // Prevent submission if not in recovery mode
        if (!isRecoveryMode) {
            setErrorKey('');
            setErrorMessage(t('auth.reset.errors.invalidSession'));
            return;
        }

        setIsLoading(true);
        setErrorKey('');
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const result = await resetPassword(data.newPassword);

            if (result.success) {
                if (isMountedRef.current) {
                    setSuccessMessage(t('auth.reset.success'));
                }

                // The recovery session is still active, so continue to the dashboard.
                redirectTimerRef.current = setTimeout(() => {
                    if (isMountedRef.current) {
                        navigate(buildDashboardHref(), { replace: true });
                    }
                }, 1500);
            } else {
                if (isMountedRef.current) {
                    setErrorMessage(result.error);
                }
            }
        } catch (error) {
            if (isMountedRef.current) {
                setErrorMessage(t('auth.reset.errors.resetFailed'));
            }
            console.error('Password reset error:', error);
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    };

    const resolvedErrorMessage = errorKey ? t(errorKey) : errorMessage;

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
                <div className='absolute top-20 right-10 w-20 h-20 border-4 border-brand opacity-20 rotate-45 animate-spin-slow'></div>
                <div className='absolute bottom-32 left-16 w-16 h-16 bg-brand opacity-10 rounded-full animate-pulse-slow'></div>
                <div className='absolute top-1/3 left-1/4 w-12 h-12 border-4 border-[#42a5f5] opacity-15 animate-bounce-slow'></div>

                <div className='auth-form-shell'>
                    <div className='auth-card login-card-border text-sm'>
                        <div className='flex w-full justify-end'>
                            <LanguageToggle size='sm' />
                        </div>
                        <p className='auth-title'>{t('auth.reset.verifying')}</p>
                        <div className='w-full flex justify-center py-8'>
                            <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-brand'></div>
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
            <div className='absolute top-20 right-10 w-20 h-20 border-4 border-brand opacity-20 rotate-45 animate-spin-slow'></div>
            <div className='absolute bottom-32 left-16 w-16 h-16 bg-brand opacity-10 rounded-full animate-pulse-slow'></div>
            <div className='absolute top-1/3 left-1/4 w-12 h-12 border-4 border-[#42a5f5] opacity-15 animate-bounce-slow'></div>

            <form onSubmit={handleSubmit(onSubmit)} className='auth-form-shell'>
                <div className='auth-card login-card-border text-sm'>
                    <div className='flex w-full justify-end'>
                        <LanguageToggle size='sm' />
                    </div>
                    <h1 className='auth-title'>{t('auth.reset.title')}</h1>
                <p className='auth-subtitle'>
                    {t('auth.reset.subtitle')}
                </p>

                {/* Error Message */}
                {resolvedErrorMessage && (
                    <div role='alert' className='auth-message auth-message-error'>
                        <p className='font-medium'>{t('auth.reset.errorTitle')}</p>
                        <p className='text-xs mt-1'>{resolvedErrorMessage}</p>
                        {!isRecoveryMode && (
                            <Link
                                to='/forgot-password'
                                className='text-xs underline mt-2 inline-block hover:text-red-900'
                            >
                                {t('auth.reset.requestNewLink')}
                            </Link>
                        )}
                    </div>
                )}

                {/* Success Message */}
                {successMessage && (
                    <div role='status' className='auth-message auth-message-success'>
                        <p className='font-medium'>{t('auth.reset.successTitle')}</p>
                        <p className='text-xs mt-1'>{successMessage}</p>
                        <p className='text-xs mt-2'>{t('auth.reset.redirecting')}</p>
                    </div>
                )}

                {/* Only show form if in recovery mode */}
                {isRecoveryMode && !successMessage && (
                    <>
                        <div className='w-full'>
                            <label htmlFor='reset-new-password' className='auth-label'>{t('auth.fields.newPassword')}</label>
                            <PasswordInput
                                id='reset-new-password'
                                autoComplete='new-password'
                                aria-invalid={errors.newPassword ? 'true' : undefined}
                                aria-describedby={errors.newPassword ? 'reset-new-password-error' : undefined}
                                placeholder={t('auth.placeholders.newPassword')}
                                {...register("newPassword", {
                                    required: t('auth.validation.newPasswordRequired'),
                                    minLength: {
                                        value: 6,
                                        message: t('auth.validation.passwordMin')
                                    }
                                })}
                                className='auth-input my-2'
                                disabled={isLoading}
                            />
                            {errors.newPassword && <p id='reset-new-password-error' role='alert' className='text-red-700 text-xs'>{errors.newPassword.message}</p>}
                        </div>

                        <div className='w-full'>
                            <label htmlFor='reset-confirm-password' className='auth-label'>{t('auth.fields.confirmNewPassword')}</label>
                            <PasswordInput
                                id='reset-confirm-password'
                                autoComplete='new-password'
                                aria-invalid={errors.confirmPassword ? 'true' : undefined}
                                aria-describedby={errors.confirmPassword ? 'reset-confirm-password-error' : undefined}
                                placeholder={t('auth.placeholders.confirmNewPassword')}
                                {...register("confirmPassword", {
                                    required: t('auth.validation.confirmPasswordRequired'),
                                    validate: (value) =>
                                        value === newPassword || t('auth.validation.passwordsMismatch')
                                })}
                                className='auth-input my-2'
                                disabled={isLoading}
                            />
                            {errors.confirmPassword && <p id='reset-confirm-password-error' role='alert' className='text-red-700 text-xs'>{errors.confirmPassword.message}</p>}
                        </div>

                        <button
                            type="submit"
                            className='auth-submit disabled:cursor-not-allowed disabled:opacity-50'
                            disabled={isLoading}
                        >
                            {isLoading ? t('auth.reset.submitting') : t('auth.reset.submit')}
                        </button>
                    </>
                )}

                <div className='w-full text-center space-y-2'>
                    <p>
                        {t('auth.reset.rememberPassword')} <Link to='/login' className='text-brand font-medium cursor-pointer hover:underline'>{t('auth.reset.loginLink')}</Link>
                    </p>
                </div>
            </div>
            </form>
        </div>
    );
};

export default ResetPassword;
