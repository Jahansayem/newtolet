'use client'

import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { MdMoreVert } from 'react-icons/md';
import PropertyCardMedia from './PropertyCardMedia';
import RentDisplay from './RentDisplay';
import { buildListDetailsHref } from '../lib/routePaths';
import { isRentNegotiable } from '../utils/rentDisplay';
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

const buildCardTitle = (item) => {
    const category = normalizeText(item?.category);
    const propertyType = normalizeText(item?.property_type);
    const parts = [];

    if (category) {
        parts.push(category);
    }

    if (propertyType && propertyType.toLowerCase() !== category.toLowerCase()) {
        parts.push(propertyType);
    }

    const title = parts.length ? parts.join(' ') : 'Property';
    return title.toLowerCase().includes('rent') ? title : `${title} Rent`;
};

const formatMonth = (dateValue) => {
    if (!dateValue) {
        return 'N/A';
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return 'N/A';
    }

    return date.toLocaleString('default', { month: 'long' });
};

const PropertyListingCard = ({ item, index = 0 }) => {
    const [isSaved, setIsSaved] = useState(false);
    const [isCompared, setIsCompared] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
    const [reportMessage, setReportMessage] = useState('');
    const [reportFeedback, setReportFeedback] = useState({ type: '', text: '' });
    const [isSubmittingReport, setIsSubmittingReport] = useState(false);
    const menuRef = useRef(null);
    const rentPricing = {
        rent_amount_bdt: item?.pricing?.rent_amount_bdt ?? item?.rent_amount_bdt,
        is_rent_negotiable: item?.pricing?.is_rent_negotiable ?? item?.is_rent_negotiable,
    };
    const isNegotiableRent = isRentNegotiable(rentPricing);
    const displayRentPricing = isNegotiableRent
        ? { ...rentPricing, rent_amount_bdt: null }
        : rentPricing;

    useEffect(() => {
        const syncSavedState = async () => {
            const savedPropertyIds = await getSavedPropertyIds(getStoredUser()?.id || null);
            setIsSaved(savedPropertyIds.includes(item.id));
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
    }, [item.id]);

    useEffect(() => {
        const syncComparedState = () => {
            setIsCompared(getComparedPropertyIds().includes(item.id));
        };

        syncComparedState();
        window.addEventListener(COMPARE_PROPERTIES_BROWSER_EVENT, syncComparedState);
        window.addEventListener('storage', syncComparedState);

        return () => {
            window.removeEventListener(COMPARE_PROPERTIES_BROWSER_EVENT, syncComparedState);
            window.removeEventListener('storage', syncComparedState);
        };
    }, [item.id]);

    useEffect(() => {
        if (!isMenuOpen) {
            return undefined;
        }

        const handlePointerDown = (event) => {
            if (menuRef.current?.contains(event.target)) {
                return;
            }

            setIsMenuOpen(false);
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setIsMenuOpen(false);
            }
        };

        document.addEventListener('pointerdown', handlePointerDown);
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handlePointerDown);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [isMenuOpen]);

    const toggleSave = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const result = await toggleSavedProperty(getStoredUser()?.id || null, item.id);
        setIsSaved(Boolean(result?.saved));
        setIsMenuOpen(false);
    };

    const toggleCompare = (event) => {
        event.preventDefault();
        event.stopPropagation();

        const result = toggleComparedProperty(item.id);
        setIsCompared(Boolean(result?.compared));
        setIsMenuOpen(false);
    };

    const openReportModal = (event) => {
        event.preventDefault();
        event.stopPropagation();
        setReportReason(REPORT_REASONS[0]);
        setReportMessage('');
        setReportFeedback({ type: '', text: '' });
        setIsReportOpen(true);
        setIsMenuOpen(false);
    };

    const closeReportModal = () => {
        if (isSubmittingReport) {
            return;
        }

        setIsReportOpen(false);
    };

    const handleReportSubmit = async (event) => {
        event.preventDefault();
        setReportFeedback({ type: '', text: '' });

        if (!reportReason.trim()) {
            setReportFeedback({ type: 'error', text: 'Select a report reason.' });
            return;
        }

        setIsSubmittingReport(true);

        try {
            const result = await submitPropertyReport({
                propertyId: item.id,
                userId: getStoredUser()?.id || null,
                reason: reportReason,
                message: reportMessage,
            });

            setReportFeedback({
                type: 'success',
                text: result.isLocalFallback
                    ? 'Report saved locally.'
                    : 'Report submitted successfully.',
            });
            setReportMessage('');
        } catch (error) {
            setReportFeedback({
                type: 'error',
                text: error.message || 'Unable to submit report.',
            });
        } finally {
            setIsSubmittingReport(false);
        }
    };

    return (
        <>
            <div className='group relative h-full rounded-[14px] border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md'>
                <Link
                    to={buildListDetailsHref(item.id)}
                    className='absolute inset-0 z-10 rounded-[14px]'
                    aria-label={`View details for ${buildCardTitle(item)}`}
                />
                <div className='pointer-events-none'>
                    <div className='overflow-hidden rounded-t-[14px]'>
                        <PropertyCardMedia
                            src={getCardImageSource(item)}
                            alt={`${item.category} property in ${item.location?.area || 'Bangladesh'}`}
                            eager={index < 10}
                            propertyType={item.property_type}
                            category={item.category}
                            pricing={displayRentPricing}
                        />
                    </div>

                    <div className='relative border-t border-slate-100 px-3 py-3 pr-10'>
                        {item.property_id_number && (
                            <p className='text-xs font-semibold text-slate-500'>
                                ID: #{item.property_id_number}
                            </p>
                        )}
                        <p className='line-clamp-1 text-base font-bold leading-6 text-[#1E73B8]'>
                            {buildCardTitle(item)}
                        </p>
                        <p className='line-clamp-1 text-sm leading-5 text-slate-700'>
                            {item.location?.area || 'Area not set'}{item.location?.state_district ? `, ${item.location.state_district}` : ''}
                        </p>

                        <div className='mt-3 space-y-1 text-sm leading-5 text-slate-900'>
                            <p>
                                Bed: {item.total_rooms ?? item.specifications?.total_rooms ?? 0}, Bath: {item.total_bathrooms ?? item.specifications?.total_bathrooms ?? 0}
                            </p>
                            <p>
                                To-Let from: {formatMonth(item.availability?.available_from ?? item.available_from)}
                            </p>
                            <p>
                                Rent : <RentDisplay pricing={displayRentPricing} prefix='' suffix='BDT' />
                            </p>
                        </div>

                        <div ref={menuRef} className='pointer-events-auto absolute right-2 top-11 z-20'>
                            <button
                                type='button'
                                onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    setIsMenuOpen((current) => !current);
                                }}
                                className='flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900'
                                aria-label='Property actions'
                                aria-expanded={isMenuOpen}
                            >
                                <MdMoreVert className='text-xl' />
                            </button>

                            {isMenuOpen && (
                                <div
                                    className='absolute right-0 top-8 w-40 overflow-hidden rounded-md border border-slate-200 bg-white py-1 text-sm text-slate-900 shadow-lg'
                                    onClick={(event) => {
                                        event.preventDefault();
                                        event.stopPropagation();
                                    }}
                                >
                                    <button
                                        type='button'
                                        onClick={toggleSave}
                                        className='block w-full px-3 py-2 text-left hover:bg-slate-50'
                                    >
                                        {isSaved ? 'Remove Saved' : 'Save Property'}
                                    </button>
                                    <button
                                        type='button'
                                        onClick={toggleCompare}
                                        className='block w-full px-3 py-2 text-left hover:bg-slate-50'
                                    >
                                        {isCompared ? 'Remove Compare' : 'Add to Compare'}
                                    </button>
                                    <button
                                        type='button'
                                        onClick={openReportModal}
                                        className='block w-full px-3 py-2 text-left hover:bg-slate-50'
                                    >
                                        Report Property
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {isReportOpen && (
                <div
                    className='fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4'
                    onClick={closeReportModal}
                >
                    <form
                        className='w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl'
                        onSubmit={handleReportSubmit}
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className='flex items-start justify-between gap-4'>
                            <div>
                                <h3 className='text-lg font-bold text-slate-900'>Report Property</h3>
                                <p className='mt-1 text-sm text-slate-500'>{buildCardTitle(item)}</p>
                            </div>
                            <button
                                type='button'
                                onClick={closeReportModal}
                                className='rounded-full px-2 py-1 text-xl leading-none text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                                aria-label='Close report form'
                            >
                                x
                            </button>
                        </div>

                        <label className='mt-5 block text-sm font-semibold text-slate-700'>
                            Reason
                            <select
                                value={reportReason}
                                onChange={(event) => setReportReason(event.target.value)}
                                className='mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E73B8] focus:ring-2 focus:ring-[#1E73B8]/15'
                            >
                                {REPORT_REASONS.map((reason) => (
                                    <option key={reason} value={reason}>
                                        {reason}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className='mt-4 block text-sm font-semibold text-slate-700'>
                            Message
                            <textarea
                                value={reportMessage}
                                onChange={(event) => setReportMessage(event.target.value)}
                                rows={4}
                                className='mt-2 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1E73B8] focus:ring-2 focus:ring-[#1E73B8]/15'
                                placeholder='Add details if needed'
                            />
                        </label>

                        {reportFeedback.text && (
                            <p
                                className={`mt-4 rounded-lg px-3 py-2 text-sm ${
                                    reportFeedback.type === 'success'
                                        ? 'bg-green-50 text-green-700'
                                        : 'bg-red-50 text-red-700'
                                }`}
                            >
                                {reportFeedback.text}
                            </p>
                        )}

                        <div className='mt-5 flex justify-end gap-3'>
                            <button
                                type='button'
                                onClick={closeReportModal}
                                className='rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50'
                            >
                                Cancel
                            </button>
                            <button
                                type='submit'
                                disabled={isSubmittingReport}
                                className='rounded-lg bg-[#1E73B8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#155b91] disabled:cursor-not-allowed disabled:opacity-60'
                            >
                                {isSubmittingReport ? 'Submitting...' : 'Submit Report'}
                            </button>
                        </div>
                    </form>
                </div>
            )}
        </>
    );
};

export default PropertyListingCard;
