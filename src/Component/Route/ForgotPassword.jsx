import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { requestPasswordReset } from '../../services/authService';
import { useLanguage } from '../../i18n/useLanguage';
import LanguageToggle from '../../components/LanguageToggle.jsx';
import './Login.css';

const ForgotPassword = () => {
    const { t } = useLanguage();
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const {
        register,
        formState: { errors },
        handleSubmit,
        reset,
    } = useForm();

    const onSubmit = async (data) => {
        setIsLoading(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const result = await requestPasswordReset(data.email);

            if (result.success) {
                setSuccessMessage(t('auth.forgot.linkSent'));
                reset();
            } else {
                setErrorMessage(result.error);
            }
        } catch (error) {
            setErrorMessage(t('auth.forgot.failed'));
            console.error('Password reset error:', error);
        } finally {
            setIsLoading(false);
        }
    };

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
                    <h1 className='auth-title'>{t('auth.forgot.title')}</h1>
                <p className='auth-subtitle'>{t('auth.forgot.subtitle')}</p>

                {successMessage && (
                    <div role='status' className='auth-message auth-message-success'>
                        {successMessage}
                    </div>
                )}

                {errorMessage && (
                    <div role='alert' className='auth-message auth-message-error'>
                        {errorMessage}
                    </div>
                )}

                <div className='w-full'>
                    <label htmlFor='forgot-email' className='auth-label'>{t('auth.fields.email')}</label>
                    <input
                        id='forgot-email'
                        type="email"
                        autoComplete='email'
                        aria-invalid={errors.email ? 'true' : undefined}
                        aria-describedby={errors.email ? 'forgot-email-error' : undefined}
                        placeholder={t('auth.placeholders.registeredEmail')}
                        {...register("email", {
                            required: 'auth.validation.emailRequired',
                            pattern: {
                                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                message: 'auth.validation.emailInvalid'
                            }
                        })}
                        className='auth-input my-2'
                        disabled={isLoading}
                    />
                    {errors.email && <p id='forgot-email-error' role='alert' className='text-red-700 text-xs'>{t(errors.email.message)}</p>}
                </div>

                <button
                    type="submit"
                    className='auth-submit disabled:cursor-not-allowed disabled:opacity-50'
                    disabled={isLoading}
                >
                    {isLoading ? t('auth.forgot.submitting') : t('auth.forgot.submit')}
                </button>

                <div className='w-full text-center space-y-2'>
                    <p>
                        {t('auth.forgot.rememberPassword')} <Link to='/login' className='text-brand font-medium cursor-pointer hover:underline'>{t('auth.forgot.loginLink')}</Link>
                    </p>
                    <p>
                        {t('auth.forgot.noAccount')} <Link to='/registration' className='text-brand font-medium cursor-pointer hover:underline'>{t('auth.forgot.registerLink')}</Link>
                    </p>
                </div>
            </div>
            </form>
        </div>
    );
};

export default ForgotPassword;
