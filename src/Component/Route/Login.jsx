import React, { useEffect, useMemo, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { loginUser, signInWithGoogle } from '../../services/authService';
import { buildDashboardHref, buildPageHref, canonicalizeInternalHref } from '../../lib/routePaths.js';
import { useAuth } from '../../hooks/useAuth';
import { FcGoogle } from 'react-icons/fc';
import { useLanguage } from '../../i18n/useLanguage';
import LanguageToggle from '../../components/LanguageToggle.jsx';
import PasswordInput from './PasswordInput.jsx';
import './Login.css';

const AUTH_ROUTE_PREFIXES = ['/login', '/registration', '/forgot-password', '/reset-password'];

const normalizeRedirectTarget = (rawTarget) => {
    const fallbackHref = buildDashboardHref();

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

const resolveRedirectTarget = (locationState, locationSearch = '') => {
    const fallbackHref = buildDashboardHref();
    const params = new URLSearchParams(locationSearch);
    const nextTarget = params.get('next');

    if (nextTarget) {
        return normalizeRedirectTarget(nextTarget);
    }

    const from = locationState?.from;

    if (!from) {
        return fallbackHref;
    }

    const rawTarget =
        typeof from === 'string'
            ? from
            : from.href || `${from.pathname || ''}${from.search || ''}${from.hash || ''}`;

    return normalizeRedirectTarget(rawTarget);
};

const getOAuthErrorMessage = (locationSearch = '', locationHash = '', t) => {
    const params = new URLSearchParams(locationSearch);
    const hashParams = new URLSearchParams(locationHash.replace(/^#/, ''));
    const error = params.get('error') || hashParams.get('error');
    const description = params.get('error_description') || hashParams.get('error_description');

    if (!error && !description) {
        return '';
    }

    if (description?.toLowerCase().includes('already') || description?.toLowerCase().includes('identity')) {
        return t('auth.google.linkFailed');
    }

    return description || t('auth.google.signInFailed');
};

const Login = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated, isLoading: isAuthLoading, handleLogin } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [allowRenderWhileAuthPending, setAllowRenderWhileAuthPending] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [hasAttemptedLogin, setHasAttemptedLogin] = useState(false);
    const redirectTarget = useMemo(
        () => resolveRedirectTarget(location.state, location.search),
        [location.state, location.search]
    );
    const isMountedRef = useRef(true);
    const hasNavigatedRef = useRef(false);

    // Surface OAuth errors passed back in the URL
    useEffect(() => {
        if (typeof window === 'undefined') return;

        const oauthError = getOAuthErrorMessage(location.search, location.hash, t);

        if (oauthError) {
            setErrorMessage(oauthError);
            window.history.replaceState({}, '', buildPageHref('login'));
        }
    }, [location.search, location.hash, t]);

    // Only navigate after a successful login attempt, not during initial auth check
    useEffect(() => {
        // Prevent multiple navigations and ensure component is mounted
        if (!isMountedRef.current || hasNavigatedRef.current) {
            return;
        }

        if (hasAttemptedLogin && !isAuthLoading && isAuthenticated) {
            hasNavigatedRef.current = true;
            // Small delay to ensure router is fully ready
            const navTimer = setTimeout(() => {
                if (isMountedRef.current) {
                    navigate(redirectTarget, { replace: true });
                }
            }, 0);
            return () => clearTimeout(navTimer);
        }
    }, [hasAttemptedLogin, isAuthLoading, isAuthenticated, navigate, redirectTarget]);

    // Cleanup on unmount
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Redirect already authenticated users away from login page
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
        setHasAttemptedLogin(true);

        try {
            const result = await loginUser(data.email, data.password);

            if (result.success) {
                handleLogin(result.user, result.session);
                // Navigate will be handled by the useEffect when isAuthenticated becomes true
            } else {
                setErrorMessage(result.error);
                setHasAttemptedLogin(false);
            }
        } catch (error) {
            setErrorMessage(t('auth.login.failed'));
            console.error('Login error:', error);
            setHasAttemptedLogin(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleSignIn = async () => {
        setIsGoogleLoading(true);
        setErrorMessage('');

        const redirectUrl = new URL(buildPageHref('login'), window.location.origin);
        redirectUrl.searchParams.set('oauth', 'google');
        redirectUrl.searchParams.set('next', redirectTarget);

        const result = await signInWithGoogle({
            redirectTo: redirectUrl.toString(),
        });

        if (!result.success && isMountedRef.current) {
            setErrorMessage(result.error);
            setIsGoogleLoading(false);
        }
    };

    if ((isAuthLoading && !allowRenderWhileAuthPending) || isAuthenticated) {
        return (
            <div className='auth-shell min-h-screen justify-center'>
                <span className='loading loading-spinner loading-xl text-brand'></span>
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
                <h1 className='auth-title'>{t('auth.login.title')}</h1>
                <p className='auth-subtitle'>{t('auth.login.subtitle')}</p>

                {errorMessage && (
                    <div role='alert' className='auth-message auth-message-error'>
                        {errorMessage}
                    </div>
                )}

                <div className='w-full'>
                    <label htmlFor='login-email' className='auth-label'>{t('auth.fields.email')}</label>
                    <input
                        id='login-email'
                        type="email"
                        autoComplete='email'
                        aria-invalid={errors.email ? 'true' : undefined}
                        aria-describedby={errors.email ? 'login-email-error' : undefined}
                        placeholder={t('auth.placeholders.email')}
                        {...register("email", {
                            required: t('auth.validation.emailRequired'),
                            pattern: {
                                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                message: t('auth.validation.emailInvalid')
                            }
                        })}
                        className='auth-input my-2'
                        disabled={isLoading || isGoogleLoading}
                    />
                    {errors.email && <p id='login-email-error' role='alert' className='text-red-700 text-xs'>{errors.email.message}</p>}
                </div>

                <div className='w-full'>
                    <label htmlFor='login-password' className='auth-label'>{t('auth.fields.password')}</label>
                    <PasswordInput
                        id='login-password'
                        autoComplete='current-password'
                        aria-invalid={errors.password ? 'true' : undefined}
                        aria-describedby={errors.password ? 'login-password-error' : undefined}
                        placeholder={t('auth.placeholders.password')}
                        {...register("password", {
                            required: t('auth.validation.passwordRequired'),
                            minLength: {
                                value: 6,
                                message: t('auth.validation.passwordMin')
                            }
                        })}
                        className='auth-input my-2'
                        disabled={isLoading || isGoogleLoading}
                    />
                    {errors.password && <p id='login-password-error' role='alert' className='text-red-700 text-xs'>{errors.password.message}</p>}
                </div>

                <button
                    type="submit"
                    className='auth-submit disabled:cursor-not-allowed disabled:opacity-50'
                    disabled={isLoading || isGoogleLoading}
                >
                    {isLoading ? t('auth.login.submitting') : t('auth.login.submit')}
                </button>

                <div className='auth-divider' aria-hidden='true'>
                    <span></span>
                    <p>{t('auth.or')}</p>
                    <span></span>
                </div>

                <button
                    type='button'
                    className='auth-google-button'
                    onClick={handleGoogleSignIn}
                    disabled={isLoading || isGoogleLoading}
                >
                    <FcGoogle className='auth-google-icon' aria-hidden='true' />
                    <span>{isGoogleLoading ? t('auth.google.connecting') : t('auth.google.continue')}</span>
                </button>

                <div className='w-full space-y-2 pt-2 text-center'>
                    <p>
                        {t('auth.login.noAccount')} <Link to='/registration' className='text-brand font-medium cursor-pointer hover:underline'>{t('auth.login.registerHere')}</Link>
                    </p>
                    <p className='pt-1'>
                        <Link to='/forgot-password' className='text-brand font-semibold cursor-pointer hover:underline text-sm inline-block border-b border-transparent hover:border-brand pb-0.5 transition-all'>{t('auth.login.forgotPassword')}</Link>
                    </p>
                </div>
            </div>
            </form>
        </div>
    );
};

export default Login;
