import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../services/supabaseClient';
import { FaGift } from 'react-icons/fa';
import { getPublicReferralCandidate } from '../../services/referralService';
import './Login.css';

const Registration = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
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

    // Check for referral link in URL on mount
    useEffect(() => {
        const refInput = searchParams.get('ref');
        if (refInput) {
            setFormData(prev => ({ ...prev, referralCode: refInput }));
            validateReferralInput(refInput);
        }
    }, [searchParams]);

    const validateReferralInput = async (input) => {
        const referralInput = String(input || '').trim();
        if (!referralInput) {
            setReferrerName('');
            setReferralPreviewError('');
            return;
        }

        try {
            const { data, error } = await getPublicReferralCandidate(referralInput);

            if (!error && data) {
                setReferrerName(data.name);
                setReferralPreviewError('');
            } else {
                setReferrerName('');
                setReferralPreviewError(referralInput.length >= 4 ? 'Referral username not found.' : '');
            }
        } catch (error) {
            console.error('Error validating referral input:', error);
            setReferrerName('');
            setReferralPreviewError('');
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
            newErrors.name = 'Name is required';
        }

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(formData.email)) {
            newErrors.email = 'Invalid email address';
        }

        if (!formData.phone.trim()) {
            newErrors.phone = 'Phone number is required';
        } else if (!/^[0-9]{10,15}$/.test(formData.phone.replace(/[\s-]/g, ''))) {
            newErrors.phone = 'Invalid phone number (10-15 digits)';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        } else if (formData.password.length > 20) {
            newErrors.password = 'Password must be less than 20 characters';
        }

        if (formData.referralCode.trim() && !referrerName) {
            newErrors.referralCode = 'Please enter a valid referral username or code.';
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
                throw new Error('Registration failed - no user created');
            }

            // Check if email confirmation is required
            if (data.user.identities && data.user.identities.length === 0) {
                setMessage({
                    type: 'error',
                    text: 'This email is already registered. Please login or use a different email.'
                });
                return;
            }

            setMessage({
                type: 'success',
                text: 'Registration successful! Please verify your email. If you used a referral username, bonus rules will apply automatically after paid credit purchases.'
            });

            setFormData({ name: '', email: '', phone: '', password: '', referralCode: '' });
            setReferrerName('');
            setReferralPreviewError('');

            setTimeout(() => {
                navigate('/login');
            }, 2000);

        } catch (error) {
            console.error('Registration error:', error);

            let errorMessage = 'Registration failed. Please try again.';

            if (error.message) {
                if (error.message.includes('already registered')) {
                    errorMessage = 'This email is already registered. Please login.';
                } else if (error.message.includes('valid email')) {
                    errorMessage = 'Please enter a valid email address.';
                } else if (error.message.includes('Password')) {
                    errorMessage = error.message;
                } else {
                    errorMessage = error.message;
                }
            }

            setMessage({ type: 'error', text: errorMessage });
        } finally {
            setIsLoading(false);
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
            <div className='absolute top-20 right-10 w-20 h-20 border-4 border-[#1E73B8] opacity-20 rotate-45 animate-spin-slow'></div>
            <div className='absolute bottom-32 left-16 w-16 h-16 bg-[#1E73B8] opacity-10 rounded-full animate-pulse-slow'></div>
            <div className='absolute top-1/3 left-1/4 w-12 h-12 border-4 border-[#42a5f5] opacity-15 animate-bounce-slow'></div>

            <form onSubmit={handleSubmit} className='auth-form-shell'>
                <div className='auth-card auth-card-wide login-card-border text-sm'>
                <p className='auth-title'>Registration Here</p>
                <p className='auth-subtitle'>Create your account to save properties, manage listings, and unlock contact details faster.</p>

                {message.text && (
                    <div className={`auth-message ${
                        message.type === 'success'
                            ? 'auth-message-success'
                            : 'auth-message-error'
                    }`}>
                        {message.text}
                    </div>
                )}

                <div className='w-full'>
                    <p className='auth-label'>Full Name</p>
                    <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        placeholder='Full Name'
                        className='auth-input my-2'
                        disabled={isLoading}
                    />
                    {errors.name && <p className='text-red-700 text-xs'>{errors.name}</p>}
                </div>

                <div className='w-full'>
                    <p className='auth-label'>Email</p>
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        placeholder='Email'
                        className='auth-input my-2'
                        disabled={isLoading}
                    />
                    {errors.email && <p className='text-red-700 text-xs'>{errors.email}</p>}
                </div>

                <div className='w-full'>
                    <p className='auth-label'>Phone Number</p>
                    <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleChange}
                        placeholder='Phone Number (e.g., 01712345678)'
                        className='auth-input my-2'
                        disabled={isLoading}
                    />
                    {errors.phone && <p className='text-red-700 text-xs'>{errors.phone}</p>}
                </div>

                <div className='w-full'>
                    <p className='auth-label'>Password</p>
                    <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Password (6-20 characters)"
                        className='auth-input my-2'
                        disabled={isLoading}
                    />
                    {errors.password && <p className='text-red-700 text-xs'>{errors.password}</p>}
                </div>

                {/* Referral Field */}
                <div className='w-full'>
                    <p className='auth-label flex items-center gap-2'>
                        <FaGift className='text-green-500' />
                        Referral Username or Code (Optional)
                    </p>
                    <input
                        type="text"
                        name="referralCode"
                        value={formData.referralCode}
                        onChange={handleReferralCodeChange}
                        placeholder='Enter referral username or legacy code'
                        className='auth-input my-2'
                        disabled={isLoading}
                        maxLength={32}
                    />
                    {referrerName && (
                        <p className='text-green-600 text-xs flex items-center gap-1'>
                            <FaGift /> Referred by: {referrerName}
                        </p>
                    )}
                    {errors.referralCode && (
                        <p className='text-red-700 text-xs'>{errors.referralCode}</p>
                    )}
                    {!referrerName && referralPreviewError && (
                        <p className='text-red-600 text-xs'>{referralPreviewError}</p>
                    )}
                    <p className='text-gray-400 text-xs'>
                        Referred users can receive bonus credits on paid purchases, and referrers earn commission automatically.
                    </p>
                </div>

                <button
                    type="submit"
                    className='auth-submit disabled:cursor-not-allowed disabled:opacity-50'
                    disabled={isLoading}
                >
                    {isLoading ? "Registering..." : "Register"}
                </button>

                <p className='w-full py-2 text-center'>
                    Already have an account?{' '}
                    <Link to='/login' className='text-[#1E73B8] font-medium cursor-pointer hover:underline'>
                        Login
                    </Link>
                </p>
            </div>
            </form>
        </div>
    );
};

export default Registration;
