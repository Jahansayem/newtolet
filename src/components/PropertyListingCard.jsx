'use client'

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MdMoreVert } from 'react-icons/md';
import { RxCross2 } from 'react-icons/rx';
import { FiCalendar, FiHeart, FiMapPin } from 'react-icons/fi';
import { LuBath, LuBedDouble } from 'react-icons/lu';
import PropertyCardMedia from './PropertyCardMedia';
import RentDisplay from './RentDisplay';
import { buildListDetailsHref } from '../lib/routePaths';
import { isRentNegotiable } from '../utils/rentDisplay';
import { getPropertyIdNumber } from '../utils/propertyDisplaySerial';
import { getStoredUser } from '../services/authService';
import {
    getSavedPropertyIds,
    toggleSavedProperty,
    SAVED_PROPERTIES_BROWSER_EVENT,
} from '../services/userPanelService';
import {
    COMPARE_PROPERTIES_BROWSER_EVENT,
    getComparedPropertyIds,
    toggleComparedProperty,
} from '../services/propertyCompareService';
import { submitPropertyReport } from '../services/propertyReportService';
import { useLanguage } from '../i18n/useLanguage';

const getCardImageSource = (item) =>
    item?.primary_image ||
    item?.images?.find((image) => typeof image === 'string' && image.trim()) ||
    (typeof item?.image_url === 'string' && item.image_url.trim() ? item.image_url.trim() : null);

const REPORT_REASONS = [
    'Wrong information',
    'Already rented',
    'Duplicate listing',
    'Suspicious listing',
    'Other',
];

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const buildCardTitle = (item, t, tv) => {
    const category = normalizeText(item?.category);
    const propertyType = normalizeText(item?.property_type);
    const parts = [];

    if (category) {
        parts.push(tv('categories', category));
    }

    if (propertyType && propertyType.toLowerCase() !== category.toLowerCase()) {
        parts.push(tv('propertyTypes', propertyType));
    }

    const title = parts.length ? parts.join(' ') : t('listing.card.titleFallback');
    return title.toLowerCase().includes('rent') ? title : t('listing.card.rentTitle', { title });
};

const formatMonth = (dateValue, fd, fallback) => {
    if (!dateValue) {
        return fallback;
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return fallback;
    }

    return fd(date, { month: 'short' });
};

const PropertyListingCard = ({
    item,
    index = 0,
    savedPropertyIds = null,
    comparedPropertyIds = null,
    onSavedPropertiesChange = null,
    onComparedPropertiesChange = null,
}) => {
    const { t, tv, fd } = useLanguage();
    const [isSaved, setIsSaved] = useState(false);
    const [isCompared, setIsCompared] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
    const [reportMessage, setReportMessage] = useState('');
    const [reportFeedback, setReportFeedback] = useState({ type: '', text: '' });
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);
    const [saveStatus, setSaveStatus] = useState('');
    const reportTitleId = useId();
    const menuId = useId();
    const reportReasonRef = useRef(null);
    const menuRef = useRef(null);
    const menuButtonRef = useRef(null);
    const isMountedRef = useRef(true);
    const itemId = item?.id;
    const rentPricing = useMemo(() => ({
        rent_amount_bdt: item?.pricing?.rent_amount_bdt ?? item?.rent_amount_bdt,
        is_rent_negotiable: item?.pricing?.is_rent_negotiable ?? item?.is_rent_negotiable,
    }), [item?.pricing?.rent_amount_bdt, item?.pricing?.is_rent_negotiable, item?.rent_amount_bdt, item?.is_rent_negotiable]);
    const isNegotiableRent = useMemo(() => isRentNegotiable(rentPricing), [rentPricing]);
    const displayRentPricing = useMemo(() => (
        isNegotiableRent
            ? { ...rentPricing, rent_amount_bdt: null }
            : rentPricing
    ), [isNegotiableRent, rentPricing]);
    const cardTitle = useMemo(() => buildCardTitle(item, t, tv), [item, t, tv]);
    const cardImageSource = useMemo(() => getCardImageSource(item), [item]);

    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        if (Array.isArray(savedPropertyIds)) {
            setIsSaved(savedPropertyIds.includes(itemId));
        }
    }, [itemId, savedPropertyIds]);

    useEffect(() => {
        if (Array.isArray(comparedPropertyIds)) {
            setIsCompared(comparedPropertyIds.includes(itemId));
        }
    }, [comparedPropertyIds, itemId]);

    useEffect(() => {
        if (Array.isArray(savedPropertyIds)) {
            return undefined;
        }

        const syncSavedState = async () => {
            const savedPropertyIds = await getSavedPropertyIds(getStoredUser()?.id || null);

            if (isMountedRef.current) {
                setIsSaved(savedPropertyIds.includes(itemId));
            }
        };

        void syncSavedState();
        window.addEventListener(SAVED_PROPERTIES_BROWSER_EVENT, syncSavedState);
        window.addEventListener('storage', syncSavedState);
        window.addEventListener('userLogin', syncSavedState);
        window.addEventListener('userLogout', syncSavedState);

        return () => {
            window.removeEventListener(SAVED_PROPERTIES_BROWSER_EVENT, syncSavedState);
            window.removeEventListener('storage', syncSavedState);
            window.removeEventListener('userLogin', syncSavedState);
            window.removeEventListener('userLogout', syncSavedState);
        };
    }, [itemId, savedPropertyIds]);

    useEffect(() => {
        if (Array.isArray(comparedPropertyIds)) {
            return undefined;
        }

        const syncComparedState = () => {
            if (isMountedRef.current) {
                setIsCompared(getComparedPropertyIds().includes(itemId));
            }
        };

        syncComparedState();
        window.addEventListener(COMPARE_PROPERTIES_BROWSER_EVENT, syncComparedState);
        window.addEventListener('storage', syncComparedState);

        return () => {
            window.removeEventListener(COMPARE_PROPERTIES_BROWSER_EVENT, syncComparedState);
            window.removeEventListener('storage', syncComparedState);
        };
    }, [comparedPropertyIds, itemId]);

    useEffect(() => {
        if (!isMenuOpen) {
            return undefined;
        }

        const handlePointerDown = (event) => {
            if (menuRef.current?.contains(event.target)) {
                return;
            }

            if (isMountedRef.current) {
                setIsMenuOpen(false);
            }
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                if (isMountedRef.current) {
                    setIsMenuOpen(false);
                    menuButtonRef.current?.focus();
                }
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isMenuOpen]);

    const toggleSave = useCallback(async (event) => {
        event.preventDefault();
        event.stopPropagation();

        try {
            const result = await toggleSavedProperty(getStoredUser()?.id || null, itemId);

            if (isMountedRef.current) {
                setIsSaved(Boolean(result?.saved));
                setSaveStatus(result?.saved ? 'saved' : 'removed');
                setIsMenuOpen(false);
            }

            if (Array.isArray(result?.propertyIds)) {
                onSavedPropertiesChange?.(result.propertyIds);
            }
        } catch (error) {
            console.error('Error toggling saved property:', error);
            if (isMountedRef.current) {
                setSaveStatus('error');
            }
        }
    }, [itemId, onSavedPropertiesChange]);

    const toggleCompare = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();

        const result = toggleComparedProperty(itemId);

        if (isMountedRef.current) {
            setIsCompared(Boolean(result?.compared));
            setIsMenuOpen(false);
            menuButtonRef.current?.focus();
        }

        if (Array.isArray(result?.propertyIds)) {
            onComparedPropertiesChange?.(result.propertyIds);
        }
    }, [itemId, onComparedPropertiesChange]);

    const openReportModal = useCallback((event) => {
        event.preventDefault();
        event.stopPropagation();
        setReportReason(REPORT_REASONS[0]);
        setReportMessage('');
        setReportFeedback({ type: '', text: '' });
        setIsReportOpen(true);
        setIsMenuOpen(false);
    }, []);

    const closeReportModal = useCallback(() => {
        if (isSubmittingReport) {
            return;
        }

        setIsReportOpen(false);
        menuButtonRef.current?.focus();
    }, [isSubmittingReport]);

    const handleReportSubmit = useCallback(async (event) => {
        event.preventDefault();
        setReportFeedback({ type: '', text: '' });

        if (!reportReason.trim()) {
            setReportFeedback({ type: 'error', text: t('listing.card.report.selectReason') });
            return;
        }

        setIsSubmittingReport(true);

        try {
            const result = await submitPropertyReport({
                propertyId: itemId,
                userId: getStoredUser()?.id || null,
                reason: reportReason,
                message: reportMessage,
            });

            if (isMountedRef.current) {
                setReportFeedback({
                    type: 'success',
                    text: result.isLocalFallback
                        ? t('listing.card.report.savedLocally')
                        : t('listing.card.report.submitted'),
                });
                setReportMessage('');
            }
        } catch (error) {
            if (isMountedRef.current) {
                setReportFeedback({
                    type: 'error',
                    text: error.message || t('listing.card.report.failed'),
                });
            }
        } finally {
            if (isMountedRef.current) {
                setIsSubmittingReport(false);
            }
        }
    }, [itemId, reportMessage, reportReason, t]);

    useEffect(() => {
        if (!saveStatus) {
            return undefined;
        }

        const timer = setTimeout(() => {
            if (isMountedRef.current) {
                setSaveStatus('');
            }
        }, 2500);

        return () => clearTimeout(timer);
    }, [saveStatus]);

    useEffect(() => {
        if (!isReportOpen) {
            return undefined;
        }

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                closeReportModal();
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        const frame = requestAnimationFrame(() => reportReasonRef.current?.focus());

        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            cancelAnimationFrame(frame);
        };
    }, [isReportOpen, closeReportModal]);

    // Stable public Property ID from the database; never a list position.
    const propertyIdNumber = getPropertyIdNumber(item);
    const propertyIdLabel = propertyIdNumber ? t('listing.card.idLabel', { id: propertyIdNumber }) : '';
    const bedCount = item.total_rooms ?? item.specifications?.total_rooms ?? 0;
    const bathCount = item.total_bathrooms ?? item.specifications?.total_bathrooms ?? 0;
    const availableMonth = formatMonth(item.availability?.available_from ?? item.available_from, fd, t('common.na'));
    const areaText = `${item.location?.area || t('listing.card.areaNotSet')}${item.location?.state_district ? `, ${item.location.state_district}` : ''}`;

    return (
        <>
            <article className='ui-card ui-card-interactive group relative flex h-full flex-col'>
                <Link
                    to={buildListDetailsHref(item.id)}
                    className='absolute inset-0 z-10 rounded-[var(--radius-card)]'
                    aria-label={propertyIdLabel
                        ? t('listing.card.viewDetailsLabelled', { title: cardTitle, label: propertyIdLabel })
                        : t('listing.card.viewDetails', { title: cardTitle })}
                />

                <div className='pointer-events-none flex h-full flex-col'>
                    <div className='overflow-hidden rounded-t-[var(--radius-card)]'>
                        <PropertyCardMedia
                            src={cardImageSource}
                            alt={t('listing.card.imageAlt', {
                                category: tv('categories', item.category),
                                area: item.location?.area || t('listing.card.defaultCountry'),
                            })}
                            eager={index < 10}
                            propertyType={item.property_type}
                            category={item.category}
                            pricing={displayRentPricing}
                            isPinned={item.is_pinned}
                        />
                    </div>

                    <div className='flex flex-1 flex-col px-3 pb-3 pt-2.5'>
                        {/* Price first: the one number every tenant scans for. */}
                        <p className='ui-price text-xl leading-7'>
                            {isNegotiableRent ? (
                                <span className='ui-badge ui-badge-neutral text-sm'>{t('listing.negotiable')}</span>
                            ) : (
                                <RentDisplay
                                    pricing={displayRentPricing}
                                    prefix='৳ '
                                    suffix={t('listing.card.perMonthShort')}
                                    suffixClassName='text-sm font-medium text-muted'
                                />
                            )}
                        </p>

                        <h3 className='mt-1 line-clamp-2 min-h-[2.75rem] text-[15px] font-semibold leading-[22px] text-ink'>
                            {cardTitle}
                        </h3>

                        <p className='mt-0.5 flex min-w-0 items-center gap-1 text-caption text-muted'>
                            <FiMapPin className='shrink-0' aria-hidden='true' />
                            <span className='truncate' title={areaText}>{areaText}</span>
                        </p>

                        <ul className='mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink/85' aria-label={t('listing.card.specsLabel')}>
                            <li className='inline-flex items-center gap-1'>
                                <LuBedDouble className='text-base text-muted' aria-hidden='true' />
                                <span>{t('listing.card.beds', { count: bedCount })}</span>
                            </li>
                            <li className='inline-flex items-center gap-1'>
                                <LuBath className='text-base text-muted' aria-hidden='true' />
                                <span>{t('listing.card.baths', { count: bathCount })}</span>
                            </li>
                            <li className='inline-flex items-center gap-1'>
                                <FiCalendar className='text-base text-muted' aria-hidden='true' />
                                <span>{t('listing.card.availableFrom', { month: availableMonth })}</span>
                            </li>
                        </ul>

                        <div className='mt-auto flex items-center justify-between gap-2 border-t border-line pt-2.5'>
                            {propertyIdLabel ? (
                                <span className='ui-id-ticket' title={t('listing.card.idTicketTitle')}>{propertyIdLabel}</span>
                            ) : <span />}

                            <div className='pointer-events-auto relative z-20 flex items-center gap-0.5'>
                                <button
                                    type='button'
                                    onClick={toggleSave}
                                    aria-pressed={isSaved}
                                    aria-label={isSaved ? t('listing.card.removeSaved') : t('listing.card.saveProperty')}
                                    className={`ui-btn ui-btn-icon ${isSaved ? 'bg-danger-soft text-danger' : 'ui-btn-ghost text-muted hover:text-danger'}`}
                                >
                                    <FiHeart className='text-lg' fill={isSaved ? 'currentColor' : 'none'} aria-hidden='true' />
                                </button>

                                <div ref={menuRef} className='relative'>
                                    <button
                                        ref={menuButtonRef}
                                        type='button'
                                        onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            setIsMenuOpen((current) => !current);
                                        }}
                                        className='ui-btn ui-btn-ghost ui-btn-icon text-muted'
                                        aria-label={t('listing.card.actions')}
                                        aria-haspopup='menu'
                                        aria-expanded={isMenuOpen}
                                        aria-controls={menuId}
                                    >
                                        <MdMoreVert className='text-xl' aria-hidden='true' />
                                    </button>

                                    {isMenuOpen && (
                                        <div
                                            id={menuId}
                                            role='menu'
                                            className='absolute bottom-full right-0 mb-1 w-48 overflow-hidden rounded-xl border border-line bg-white py-1 text-sm text-ink shadow-overlay'
                                            onClick={(event) => {
                                                event.preventDefault();
                                                event.stopPropagation();
                                            }}
                                        >
                                            <button
                                                type='button'
                                                role='menuitem'
                                                onClick={toggleCompare}
                                                className='block w-full px-3 py-2.5 text-left hover:bg-brand-soft hover:text-brand-pressed'
                                            >
                                                {isCompared ? t('listing.card.removeCompare') : t('listing.card.addToCompare')}
                                            </button>
                                            <button
                                                type='button'
                                                role='menuitem'
                                                onClick={openReportModal}
                                                className='block w-full px-3 py-2.5 text-left hover:bg-brand-soft hover:text-brand-pressed'
                                            >
                                                {t('listing.card.reportProperty')}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <p
                            role='status'
                            aria-live='polite'
                            className={saveStatus
                                ? `mt-2 rounded-lg px-2.5 py-1.5 text-caption font-medium ${saveStatus === 'error' ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'}`
                                : 'sr-only'}
                        >
                            {saveStatus === 'saved'
                                ? t('listing.card.savedStatus')
                                : saveStatus === 'removed'
                                    ? t('listing.card.removedStatus')
                                    : saveStatus === 'error'
                                        ? t('listing.card.saveFailed')
                                        : ''}
                        </p>
                    </div>
                </div>
            </article>

            {isReportOpen && (
                <div
                    className='fixed inset-0 z-[100] flex items-center justify-center bg-ink/55 px-4'
                    onClick={closeReportModal}
                >
                    <form
                        role='dialog'
                        aria-modal='true'
                        aria-labelledby={reportTitleId}
                        className='ui-panel max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto p-5 shadow-overlay sm:p-6'
                        onSubmit={handleReportSubmit}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className='flex items-start justify-between gap-4'>
                            <div>
                                <h3 id={reportTitleId} className='text-lg font-bold text-ink'>{t('listing.card.report.title')}</h3>
                                <p className='mt-1 text-sm text-muted'>{cardTitle}</p>
                            </div>
                            <button
                                type='button'
                                onClick={closeReportModal}
                                className='ui-btn ui-btn-ghost ui-btn-icon shrink-0 text-muted'
                                aria-label={t('listing.card.report.close')}
                            >
                                <RxCross2 className='text-xl' aria-hidden='true' />
                            </button>
                        </div>

                        <label className='mt-5 block'>
                            <span className='ui-label'>{t('listing.card.report.reason')}</span>
                            <select
                                ref={reportReasonRef}
                                value={reportReason}
                                onChange={(event) => setReportReason(event.target.value)}
                                className='ui-field'
                            >
                                {REPORT_REASONS.map((reason) => (
                                    <option key={reason} value={reason}>
                                        {tv('reportReasons', reason)}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className='mt-4 block'>
                            <span className='ui-label'>{t('listing.card.report.message')}</span>
                            <textarea
                                value={reportMessage}
                                onChange={(event) => setReportMessage(event.target.value)}
                                rows={4}
                                className='ui-field'
                                placeholder={t('listing.card.report.messagePlaceholder')}
                            />
                        </label>

                        {reportFeedback.text && (
                            <p
                                role={reportFeedback.type === 'error' ? 'alert' : 'status'}
                                className={`ui-note mt-4 ${reportFeedback.type === 'success' ? 'ui-note-success' : 'ui-note-danger'}`}
                            >
                                {reportFeedback.text}
                            </p>
                        )}

                        <div className='mt-5 flex justify-end gap-3'>
                            <button
                                type='button'
                                onClick={closeReportModal}
                                className='ui-btn ui-btn-secondary ui-btn-sm'
                            >
                                {t('common.cancel')}
                            </button>
                            <button
                                type='submit'
                                disabled={isSubmittingReport}
                                className='ui-btn ui-btn-primary ui-btn-sm'
                            >
                                {isSubmittingReport ? t('listing.card.report.submitting') : t('listing.card.report.submit')}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
};

export default PropertyListingCard;
