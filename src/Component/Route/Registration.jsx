import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { FaGift } from 'react-icons/fa';
import { FcGoogle } from 'react-icons/fc';
import { getPublicReferralCandidate } from '../../services/referralService';
import { signInWithGoogle } from '../../services/authService';
import { buildDashboardHref, buildPageHref } from '../../lib/routePaths.js';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../i18n/useLanguage';
import LanguageToggle from '../../components/LanguageToggle.jsx';
import PasswordInput from './PasswordInput.jsx';
import './Login.css';

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

    return description || t('auth.google.signUpFailed');
};

const Registration = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [isGoogleLoading, setIsGoogleLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        password: '',
        referralCode: ''
    });
    const [errors, setErrors] = useState({});
    const [referrerName, setReferrerName] = useState('');
    const [referralPreviewError, setReferralPreviewError] = useState('');
    const isMountedRef = useRef(true);
    const redirectTimerRef = useRef(null);
    const hasNavigatedRef = useRef(false);
    const redirectTarget = buildDashboardHref();

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

    useEffect(() => {
        if (!isMountedRef.current) return;

        const oauthError = getOAuthErrorMessage(location.search, location.hash, t);

        if (!oauthError) {
            return;
        }

        setMessage({ type: 'error', text: oauthError });
        setIsGoogleLoading(false);

        if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', buildPageHref('registration'));
        }
    }, [location.search, location.hash, t]);

    useEffect(() => {
        if (hasNavigatedRef.current || isAuthLoading || !isAuthenticated) {
            return;
        }

        hasNavigatedRef.current = true;
        navigate(redirectTarget, { replace: true });
    }, [isAuthLoading, isAuthenticated, navigate, redirectTarget]);

    // Check for referral link in URL on mount
    useEffect(() => {
        const refInput = searchParams.get('ref');
        if (refInput && isMountedRef.current) {
            setFormData(prev => ({ ...prev, referralCode: refInput }));
            validateReferralInput(refInput);
        }
    }, [searchParams]);

    const validateReferralInput = async (input) => {
        const referralInput = String(input || '').trim();
        if (!referralInput) {
            if (isMountedRef.current) {
                setReferrerName('');
                setReferralPreviewError('');
            }
            return;
        }

        try {
            const { data, error } = await getPublicReferralCandidate(referralInput);

            if (!error && data && isMountedRef.current) {
                setReferrerName(data.name);
                setReferralPreviewError('');
            } else if (isMountedRef.current) {
                setReferrerName('');
                setReferralPreviewError(referralInput.length >= 4 ? t('auth.register.referral.notFound') : '');
            }
        } catch (error) {
            console.error('Error validating referral input:', error);
            if (isMountedRef.current) {
                setReferrerName('');
                setReferralPreviewError('');
            }
        }
    };

    const handleReferralCodeChange = (e) => {
        const input = e.target.value;
        setFormData(prev => ({ ...prev, referralCode: input }));
        if (errors.referralCode) {
            setErrors(prev => ({ ...prev, referralCode: '' }));
        }
        void validateReferralInput(input);
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = t('auth.validation.nameRequired');
        }

        if (!formData.email.trim()) {
            newErrors.email = t('auth.validation.emailRequired');
        } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.email)) {
            newErrors.email = t('auth.validation.emailInvalid');
        }

        if (!formData.phone.trim()) {
            newErrors.phone = t('auth.validation.phoneRequired');
        } else if (!/^[0-9]{10,15}$/.test(formData.phone.replace(/[\s-]/g, ''))) {
            newErrors.phone = t('auth.validation.phoneInvalid');
        }

        if (!formData.password) {
            newErrors.password = t('auth.validation.passwordRequired');
        } else if (formData.password.length < 6) {
            newErrors.password = t('auth.validation.passwordMin');
        } else if (formData.password.length > 20) {
            newErrors.password = t('auth.validation.passwordMax');
        }

        if (formData.referralCode.trim() && !referrerName) {
            newErrors.referralCode = t('auth.validation.referralInvalid');
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name]) {
            setErrors(prev => ({ ...prev, [name]: '' }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) return;

        setIsLoading(true);
        setMessage({ type: '', text: '' });

        try {
            // Sign up with Supabase Auth
            const { data, error } = await supabase.auth.signUp({
                email: formData.email,
                password: formData.password,
                options: {
                    data: {
                        name: formData.name,
                        phone: formData.phone,
                        referral_input: formData.referralCode.trim() || null
                    }
                }
            });

            if (error) {
                throw error;
            }

            if (!data.user) {
                throw new Error(t('auth.register.messages.noUser'));
            }

            // Check if email confirmation is required
            if (data.user.identities && data.user.identities.length === 0) {
                if (isMountedRef.current) {
                    setMessage({
                        type: 'error',
                        text: t('auth.register.messages.alreadyRegistered')
                    });
                }
                return;
            }

            if (isMountedRef.current) {
                setMessage({
                    type: 'success',
                    text: t('auth.register.messages.success')
                });

                setFormData({ name: '', email: '', phone: '', password: '', referralCode: '' });
                setReferrerName('');
                setReferralPreviewError('');
            }

            // Redirect to login after 2 seconds
            redirectTimerRef.current = setTimeout(() => {
                if (isMountedRef.current) {
                    navigate('/login');
                }
            }, 2000);

        } catch (error) {
            console.error('Registration error:', error);

            let errorMessage = t('auth.register.messages.failed');

            if (error.message) {
                if (error.message.includes('already registered')) {
                    errorMessage = t('auth.register.messages.alreadyRegisteredShort');
                } else if (error.message.includes('valid email')) {
                    errorMessage = t('auth.register.messages.invalidEmail');
                } else if (error.message.includes('Password')) {
                    errorMessage = error.message;
                } else {
                    errorMessage = error.message;
                }
            }

            if (isMountedRef.current) {
                setMessage({ type: 'error', text: errorMessage });
            }
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    };

    const handleGoogleSignUp = async () => {
        setIsGoogleLoading(true);
        setMessage({ type: '', text: '' });

        const redirectUrl = new URL(buildPageHref('registration'), window.location.origin);
        redirectUrl.searchParams.set('oauth', 'google');
        redirectUrl.searchParams.set('next', redirectTarget);

        const result = await signInWithGoogle({
            redirectTo: redirectUrl.toString(),
        });

        if (!result.success && isMountedRef.current) {
            setMessage({ type: 'error', text: result.error });
            setIsGoogleLoading(false);
        }
    };

    return (
        <div className='auth-shell py-8'>
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

            <form onSubmit={handleSubmit} className='auth-form-shell'>
                <div className='auth-card auth-card-wide login-card-border text-sm'>
                <div className='flex w-full justify-end'>
                    <LanguageToggle size='sm' />
                </div>
                <h1 className='auth-title'>{t('auth.register.title')}</h1>
                <p className='auth-subtitle'>{t('auth.register.subtitle')}</p>

                {message.text && (
                    <div role={message.type === 'success' ? 'status' : 'alert'} className={`auth-message ${
                        message.type === 'success'
                            ? 'auth-message-success'
                            : 'auth-message-error'
                    }`}>
                        {message.text}
                    </div>
                )}

                <div className='w-full'>
                    <label htmlFor='register-name' className='auth-label'>{t('auth.fields.fullName')}</label>
                    <input
                        id='register-name'
                        autoComplete='name'
                        aria-invalid={errors.name ? 'true' : undefined}
                        aria-describedby={errors.name ? 'register-name-error' : undefined}
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder={t('auth.placeholders.fullName')}
                        className='auth-input my-2'
                        disabled={isLoading || isGoogleLoading}
                    />
                    {errors.name && <p id='register-name-error' role='alert' className='text-red-700 text-xs'>{errors.name}</p>}
                </div>

                <div className='w-full'>
                    <label htmlFor='register-email' className='auth-label'>{t('auth.fields.email')}</label>
                    <input
                        id='register-email'
                        autoComplete='email'
                        aria-invalid={errors.email ? 'true' : undefined}
                        aria-describedby={errors.email ? 'register-email-error' : undefined}
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder={t('auth.placeholders.email')}
                        className='auth-input my-2'
                        disabled={isLoading || isGoogleLoading}
                    />
                    {errors.email && <p id='register-email-error' role='alert' className='text-red-700 text-xs'>{errors.email}</p>}
                </div>

                <div className='w-full'>
                    <label htmlFor='register-phone' className='auth-label'>{t('auth.fields.phone')}</label>
                    <input
                        id='register-phone'
                        autoComplete='tel'
                        inputMode='tel'
                        aria-invalid={errors.phone ? 'true' : undefined}
                        aria-describedby={errors.phone ? 'register-phone-error' : undefined}
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder={t('auth.placeholders.phone')}
                        className='auth-input my-2'
                        disabled={isLoading || isGoogleLoading}
                    />
                    {errors.phone && <p id='register-phone-error' role='alert' className='text-red-700 text-xs'>{errors.phone}</p>}
                </div>

                <div className='w-full'>
                    <label htmlFor='register-password' className='auth-label'>{t('auth.fields.password')}</label>
                    <PasswordInput
                        id='register-password'
                        autoComplete='new-password'
                        aria-invalid={errors.password ? 'true' : undefined}
                        aria-describedby={errors.password ? 'register-password-error' : undefined}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder={t('auth.placeholders.passwordRange')}
                        className='auth-input my-2'
                        disabled={isLoading || isGoogleLoading}
                    />
                    {errors.password && <p id='register-password-error' role='alert' className='text-red-700 text-xs'>{errors.password}</p>}
                </div>

                {/* Referral Field */}
                <div className='w-full'>
                    <label htmlFor='register-referral' className='auth-label flex items-center gap-2'>
                        <FaGift className='text-green-500' aria-hidden='true' />
                        {t('auth.register.referral.label')}
                    </label>
                    <input
                        id='register-referral'
                        type="text"
                        name="referralCode"
                        value={formData.referralCode}
                        onChange={handleReferralCodeChange}
                        placeholder={t('auth.placeholders.referral')}
                        className='auth-input my-2'
                        disabled={isLoading || isGoogleLoading}
                        maxLength={32}
                    />
                    {referrerName && (
                        <p className='text-green-600 text-xs flex items-center gap-1'>
                            <FaGift /> {t('auth.register.referral.referredBy', { name: referrerName })}
                        </p>
                    )}
                    {errors.referralCode && (
                        <p className='text-red-700 text-xs'>{errors.referralCode}</p>
                    )}
                    {!referrerName && referralPreviewError && (
                        <p className='text-red-600 text-xs'>{referralPreviewError}</p>
                    )}
                    <p className='text-gray-400 text-xs'>
                        {t('auth.register.referral.hint')}
                    </p>
                </div>

                <button
                    type="submit"
                    className='auth-submit disabled:cursor-not-allowed disabled:opacity-50'
                    disabled={isLoading || isGoogleLoading}
                >
                    {isLoading ? t('auth.register.submitting') : t('auth.register.submit')}
                </button>

                <div className='auth-divider' aria-hidden='true'>
                    <span></span>
                    <p>{t('auth.or')}</p>
                    <span></span>
                </div>

                <button
                    type='button'
                    className='auth-google-button'
                    onClick={handleGoogleSignUp}
                    disabled={isLoading || isGoogleLoading}
                >
                    <FcGoogle className='auth-google-icon' aria-hidden='true' />
                    <span>{isGoogleLoading ? t('auth.google.connecting') : t('auth.google.continue')}</span>
                </button>

                <p className='w-full py-2 text-center'>
                    {t('auth.register.haveAccount')}{' '}
                    <Link to='/login' className='text-brand font-medium cursor-pointer hover:underline'>
                        {t('auth.register.loginLink')}
                    </Link>
                </p>
            </div>
            </form>
        </div>
    );
};

export default Registration;
