import React, { useId, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { submitFeedback } from '../../services/feedbackService';
import { useLanguage } from '../../i18n/useLanguage';
import { IoMdMail } from 'react-icons/io';
import { FaPhone, FaLocationDot } from 'react-icons/fa6';
import { SITE_CONTACT } from '../../config/siteContact.js';

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

            setSuccessMessage('home.contact.success');
            setFormData({ name: '', email: '', message: '' });
        } catch (error) {
            console.error('Error submitting feedback:', error);
            setErrorMessage('home.contact.error');
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
                        {t(successMessage)}
                    </p>
                )}

                {errorMessage && (
                    <p role='alert' className='ui-note ui-note-danger text-danger'>
                        {t(errorMessage)}
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

            {/* Same details as the footer and policy pages (single source: config/siteContact.js). */}
            <address className='ui-card mt-6 grid gap-3 p-5 text-sm not-italic sm:grid-cols-3 sm:p-6'>
                <a href={SITE_CONTACT.phoneHref} className='flex min-h-11 items-center gap-3 text-ink hover:text-brand'>
                    <FaPhone className='shrink-0 text-brand' aria-hidden='true' />
                    <span>{SITE_CONTACT.phoneDisplay}</span>
                </a>
                <a href={'mailto:' + SITE_CONTACT.email} className='flex min-h-11 items-center gap-3 break-all text-ink hover:text-brand'>
                    <IoMdMail className='shrink-0 text-brand' aria-hidden='true' />
                    <span>{SITE_CONTACT.email}</span>
                </a>
                <p className='flex min-h-11 items-center gap-3 text-ink'>
                    <FaLocationDot className='shrink-0 text-brand' aria-hidden='true' />
                    <span>{t('footer.address')}</span>
                </p>
            </address>
        </div>
    );
};

export default Contact;
