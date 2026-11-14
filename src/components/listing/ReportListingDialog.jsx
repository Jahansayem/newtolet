import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { RxCross2 } from 'react-icons/rx';
import { getStoredUser } from '../../services/authService';
import { submitPropertyReport } from '../../services/propertyReportService';
import { useLanguage } from '../../i18n/useLanguage';

export const REPORT_REASONS = [
    'Wrong information',
    'Already rented',
    'Duplicate listing',
    'Suspicious listing',
    'Other',
];

/**
 * "Report this listing" dialog shared by listing cards and the detail page. Reports land in
 * property_reports and appear in the admin panel's Reports tab.
 */
const ReportListingDialog = ({ open, onClose, propertyId, subtitle = '' }) => {
    const { t, tv } = useLanguage();
    const titleId = useId();
    const reasonRef = useRef(null);
    const isMountedRef = useRef(true);
    const [reason, setReason] = useState(REPORT_REASONS[0]);
    const [message, setMessage] = useState('');
    const [feedback, setFeedback] = useState({ type: '', text: '' });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (open) {
            setReason(REPORT_REASONS[0]);
            setMessage('');
            setFeedback({ type: '', text: '' });
        }
    }, [open]);

    const close = useCallback(() => {
        if (!isSubmitting) {
            onClose?.();
        }
    }, [isSubmitting, onClose]);

    useEffect(() => {
        if (!open) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                close();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        const frame = requestAnimationFrame(() => reasonRef.current?.focus());

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            cancelAnimationFrame(frame);
        };
    }, [open, close]);

    const handleSubmit = useCallback(async (event) => {
        event.preventDefault();
        setFeedback({ type: '', text: '' });

        if (!reason.trim()) {
            setFeedback({ type: 'error', text: t('listing.card.report.selectReason') });
            return;
        }

        setIsSubmitting(true);

        try {
            const result = await submitPropertyReport({
                propertyId,
                userId: getStoredUser()?.id || null,
                reason,
                message,
            });

            if (isMountedRef.current) {
                setFeedback({
                    type: 'success',
                    text: result.isLocalFallback ? t('listing.card.report.savedLocally') : t('listing.card.report.submitted'),
                });
                setMessage('');
            }
        } catch (error) {
            if (isMountedRef.current) {
                setFeedback({ type: 'error', text: error.message || t('listing.card.report.failed') });
            }
        } finally {
            if (isMountedRef.current) {
                setIsSubmitting(false);
            }
        }
    }, [message, propertyId, reason, t]);

    if (!open) {
        return null;
    }

    return (
        <div className='fixed inset-0 z-[100] flex items-center justify-center bg-ink/55 px-4' onClick={close}>
            <form
                role='dialog'
                aria-modal='true'
                aria-labelledby={titleId}
                className='ui-panel max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-5 shadow-overlay sm:p-6'
                onSubmit={handleSubmit}
                onClick={(event) => event.stopPropagation()}
            >
                <div className='flex items-start justify-between gap-4'>
                    <div>
                        <h3 id={titleId} className='text-lg font-bold text-ink'>{t('listing.card.report.title')}</h3>
                        {subtitle ? <p className='mt-1 text-sm text-muted'>{subtitle}</p> : null}
                    </div>
                    <button
                        type='button'
                        onClick={close}
                        className='ui-btn ui-btn-ghost ui-btn-icon shrink-0 text-muted'
                        aria-label={t('listing.card.report.close')}
                    >
                        <RxCross2 className='text-xl' aria-hidden='true' />
                    </button>
                </div>

                <label className='mt-5 block'>
                    <span className='ui-label'>{t('listing.card.report.reason')}</span>
                    <select ref={reasonRef} value={reason} onChange={(event) => setReason(event.target.value)} className='ui-field'>
                        {REPORT_REASONS.map((entry) => (
                            <option key={entry} value={entry}>
                                {tv('reportReasons', entry)}
                            </option>
                        ))}
                    </select>
                </label>

                <label className='mt-4 block'>
                    <span className='ui-label'>{t('listing.card.report.message')}</span>
                    <textarea
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        rows={4}
                        className='ui-field'
                        placeholder={t('listing.card.report.messagePlaceholder')}
                    />
                </label>

                {feedback.text && (
                    <p
                        role={feedback.type === 'error' ? 'alert' : 'status'}
                        className={`ui-note mt-4 ${feedback.type === 'success' ? 'ui-note-success' : 'ui-note-danger'}`}
                    >
                        {feedback.text}
                    </p>
                )}

                <div className='mt-5 flex justify-end gap-3'>
                    <button type='button' onClick={close} className='ui-btn ui-btn-secondary ui-btn-sm'>
                        {t('common.cancel')}
                    </button>
                    <button type='submit' disabled={isSubmitting} className='ui-btn ui-btn-primary ui-btn-sm'>
                        {isSubmitting ? t('listing.card.report.submitting') : t('listing.card.report.submit')}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ReportListingDialog;
