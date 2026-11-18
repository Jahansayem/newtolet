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
    MAX_COMPARE_ITEMS,
} from '../services/propertyCompareService';
import ReportListingDialog from './listing/ReportListingDialog';
import { VerifiedOwnerBadge } from './listing/ListingTrust';
import { useLanguage } from '../i18n/useLanguage';

const getCardImageSource = (item) =>
    item?.primary_image ||
    item?.images?.find((image) => typeof image === 'string' && image.trim()) ||
    (typeof item?.image_url === 'string' && item.image_url.trim() ? item.image_url.trim() : null);

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
    const [saveStatus, setSaveStatus] = useState('');
    const menuId = useId();
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
            setSaveStatus(result?.limitReached ? 'compareLimit' : result?.compared ? 'compared' : 'uncompared');
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
        setIsReportOpen(true);
        setIsMenuOpen(false);
    }, []);

    const closeReportModal = useCallback(() => {
        setIsReportOpen(false);
        menuButtonRef.current?.focus();
    }, []);

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

                        {item.owner_verified ? <VerifiedOwnerBadge compact className='mt-1' /> : null}

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
                                ? `mt-2 rounded-lg px-2.5 py-1.5 text-caption font-medium ${saveStatus === 'error' || saveStatus === 'compareLimit' ? 'bg-danger-soft text-danger' : 'bg-success-soft text-success'}`
                                : 'sr-only'}
                        >
                            {saveStatus === 'saved'
                                ? t('listing.card.savedStatus')
                                : saveStatus === 'removed'
                                    ? t('listing.card.removedStatus')
                                    : saveStatus === 'error'
                                        ? t('listing.card.saveFailed')
                                        : saveStatus === 'compared'
                                            ? t('listing.card.compareAdded')
                                            : saveStatus === 'uncompared'
                                                ? t('listing.card.compareRemoved')
                                                : saveStatus === 'compareLimit'
                                                    ? t('listing.card.compareLimit', { max: MAX_COMPARE_ITEMS })
                                                    : ''}
                        </p>
                    </div>
                </div>
            </article>

            <ReportListingDialog
                open={isReportOpen}
                onClose={closeReportModal}
                propertyId={itemId}
                subtitle={cardTitle}
            />
        </>
    );
};

export default PropertyListingCard;
