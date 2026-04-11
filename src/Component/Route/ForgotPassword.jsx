import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { requestPasswordReset } from '../../services/authService';
import './Login.css';

const ForgotPassword = () => {
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
                setSuccessMessage(result.message);
                reset();
            } else {
                setErrorMessage(result.error);
            }
        } catch (error) {
            setErrorMessage('Failed to send reset email. Please try again.');
            console.error('Password reset error:', error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className='relative min-h-[80vh] flex items-center overflow-hidden bg-gradient-to-br from-white via-blue-50 to-white'>
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

            <form onSubmit={handleSubmit(onSubmit)} className='relative z-10 w-full flex items-center justify-center'>
                <div className='flex flex-col gap-3 m-auto items-start p-8 min-w-[340px] sm:min-w-96 border-2 rounded-2xl login-card-border text-sm shadow-xl bg-white'>
                    <p className='text-2xl font-semibold mx-auto w-full text-center'>Forgot Password?</p>
                <p className='text-gray-600 text-center w-full text-sm'>Enter your email address and we'll send you a link to reset your password.</p>

                {successMessage && (
                    <div className='w-full bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded'>
                        {successMessage}
                    </div>
                )}

                {errorMessage && (
                    <div className='w-full bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded'>
                        {errorMessage}
                    </div>
                )}

                <div className='w-full'>
                    <p className='text-zinc-700 font-medium'>Email</p>
                    <input
                        type="email"
                        placeholder='Enter your registered email'
                        {...register("email", {
                            required: "Email is required",
                            pattern: {
                                value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                                message: "Invalid email address"
                            }
                        })}
                        className='w-full border border-gray-300 rounded p-2 my-2 focus:outline-none focus:border-[#1E73B8]'
                        disabled={isLoading}
                    />
                    {errors.email && <p className='text-red-700 text-xs'>{errors.email.message}</p>}
                </div>

                <button
                    type="submit"
                    className='w-full bg-[#1E73B8] py-2 rounded text-white font-medium cursor-pointer hover:bg-[#1665a0] transition disabled:opacity-50 disabled:cursor-not-allowed'
                    disabled={isLoading}
                >
                    {isLoading ? "Sending..." : "Send Reset Link"}
                </button>

                <div className='w-full text-center space-y-2'>
                    <p>
                        Remember your password? <Link to='/login' className='text-[#1E73B8] font-medium cursor-pointer hover:underline'>Login</Link>
                    </p>
                    <p>
                        Don't have an account? <Link to='/registration' className='text-[#1E73B8] font-medium cursor-pointer hover:underline'>Register</Link>
                    </p>
                </div>
            </div>
            </form>
        </div>
    );
};

export default ForgotPassword;
