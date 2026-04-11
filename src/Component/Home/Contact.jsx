import React, { useState } from 'react';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../hooks/useAuth';

const Contact = () => {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        message: ''
    });
    const [loading, setLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setSuccessMessage('');
        setErrorMessage('');

        try {
            // Submit feedback to Supabase
            const { error } = await supabase
                .from('feedback')
                .insert([{
                    name: formData.name,
                    email: formData.email,
                    feedback: formData.message,
                    user_id: user?.id || null,
                    status: 'pending', // Default to pending for admin approval
                    is_resolved: false
                }])
                .select();

            if (error) throw error;

            setSuccessMessage('Thank you for your feedback! It will be reviewed by our team.');
            setFormData({ name: '', email: '', message: '' });

            setTimeout(() => setSuccessMessage(''), 5000);
        } catch (error) {
            console.error('Error submitting feedback:', error);
            setErrorMessage('Failed to submit feedback. Please try again.');
            setTimeout(() => setErrorMessage(''), 5000);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
             <div className=' flex flex-col justify-center max-w-[480px] mx-auto mt-10 mb-10'>
                <div className='text-center space-y-2 '>
                    <h2 className='text-3xl font-medium uppercase'>Contact</h2>
                    <p>You have contact any time.</p>
                </div>
            </div>

            {/* Success Message */}
            {successMessage && (
                <div className='max-w-2xl mx-auto mb-4 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg'>
                    {successMessage}
                </div>
            )}

            {/* Error Message */}
            {errorMessage && (
                <div className='max-w-2xl mx-auto mb-4 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg'>
                    {errorMessage}
                </div>
            )}

            <form onSubmit={handleSubmit} className='max-w-2xl mx-auto text-gray-600 pt-8'>
                <div className='flex flex-wrap'>
                    <div className='w-full md:w-1/2 text-left'>Your Name
                        <input
                            className='w-full border border-gray-300 rounded py-3 px-4 mt-2'
                            name='name'
                            type="text"
                            placeholder='Your Name'
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className='w-full md:w-1/2 text-left md:pl-4'>Your Email
                        <input
                            className='w-full border border-gray-300 rounded py-3 px-4 mt-2'
                            name='email'
                            type="email"
                            placeholder='Your Email'
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>
                </div>
                <div className='my-6 text-left'>
                    Message
                    <textarea
                        className='w-full border border-gray-300 rounded py-3 px-4 mt-2 h-48 resize-none'
                        name='message'
                        placeholder='Message'
                        value={formData.message}
                        onChange={handleChange}
                        required
                    ></textarea>
                </div>
                <button
                    type='submit'
                    disabled={loading}
                    className='bg-blue-600 w-full text-white py-2 px-12 mb-10 rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed'
                >
                    {loading ? 'Sending...' : 'Send Message'}
                </button>
            </form>
        </div>
    );
};

export default Contact;
