import React, { useId, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { submitFeedback } from '../../services/feedbackService';
import { useLanguage } from '../../i18n/useLanguage';

const Contact = () => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const idPrefix = useId();
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
            const { error } = await submitFeedback({
                userId: user?.id || null,
                name: formData.name,
                email: formData.email,
                feedback: formData.message,
            });

            if (error) throw error;

            setSuccessMessage(t('home.contact.success'));
            setFormData({ name: '', email: '', message: '' });
        } catch (error) {
            console.error('Error submitting feedback:', error);
            setErrorMessage(t('home.contact.error'));
        } finally {
            setLoading(false);
        }
    };

    const fieldId = (name) => `${idPrefix}-${name}`;

    return (
        <div className='site-shell-narrow py-10 md:py-14'>
            <div className='text-center'>
                <h1 className='text-3xl font-bold leading-tight text-ink md:text-[32px]'>{t('home.contact.title')}</h1>
                <p className='mx-auto mt-2 max-w-md text-body text-muted'>{t('home.contact.subtitle')}</p>
            </div>

            <form onSubmit={handleSubmit} className='ui-card mt-8 space-y-5 p-5 sm:p-6' noValidate={false}>
                {successMessage && (
                    <p role='status' className='ui-note ui-note-success'>
                        {successMessage}
                    </p>
                )}

                {errorMessage && (
                    <p role='alert' className='ui-note ui-note-danger text-danger'>
                        {errorMessage}
                    </p>
                )}

                <div className='grid gap-5 md:grid-cols-2'>
                    <div>
                        <label htmlFor={fieldId('name')} className='ui-label'>
                            {t('home.contact.name')}<span className='ui-required' aria-hidden='true'>*</span>
                        </label>
                        <input
                            id={fieldId('name')}
                            className='ui-field'
                            name='name'
                            type='text'
                            autoComplete='name'
                            placeholder={t('home.contact.name')}
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div>
                        <label htmlFor={fieldId('email')} className='ui-label'>
                            {t('home.contact.email')}<span className='ui-required' aria-hidden='true'>*</span>
                        </label>
                        <input
                            id={fieldId('email')}
                            className='ui-field'
                            name='email'
                            type='email'
                            autoComplete='email'
                            placeholder={t('home.contact.email')}
                            value={formData.email}
                            onChange={handleChange}
                            required
                        />
                    </div>
                </div>

                <div>
                    <label htmlFor={fieldId('message')} className='ui-label'>
                        {t('home.contact.message')}<span className='ui-required' aria-hidden='true'>*</span>
                    </label>
                    <textarea
                        id={fieldId('message')}
                        className='ui-field min-h-40'
                        name='message'
                        placeholder={t('home.contact.message')}
                        value={formData.message}
                        onChange={handleChange}
                        required
                    />
                </div>

                <button
                    type='submit'
                    disabled={loading}
                    className='ui-btn ui-btn-primary w-full sm:w-auto'
                >
                    {loading ? t('home.contact.sending') : t('home.contact.send')}
                </button>
            </form>
        </div>
    );
};

export default Contact;
