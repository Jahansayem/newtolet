'use client'

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import PropertyCardMedia from './PropertyCardMedia';
import { buildListDetailsHref } from '../lib/routePaths';
import { getStoredUser } from '../services/authService';
import {
    getSavedPropertyIds,
    toggleSavedProperty,
    SAVED_PROPERTIES_BROWSER_EVENT,
} from '../services/userPanelService';

const getCardImageSource = (item) =>
    item?.primary_image ||
    item?.images?.find((image) => typeof image === 'string' && image.trim()) ||
    (typeof item?.image_url === 'string' && item.image_url.trim() ? item.image_url.trim() : null);

const PropertyListingCard = ({ item, index = 0 }) => {
    const [isSaved, setIsSaved] = useState(false);
    const rentAmount = item?.pricing?.rent_amount_bdt ?? item?.rent_amount_bdt ?? 0;

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

    const toggleSave = async (event) => {
        event.preventDefault();
        event.stopPropagation();

        const result = await toggleSavedProperty(getStoredUser()?.id || null, item.id);
        setIsSaved(Boolean(result?.saved));
    };

    return (
        <Link to={buildListDetailsHref(item.id)}>
            <div className='bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden'>
                <div className='relative'>
                    <PropertyCardMedia
                        src={getCardImageSource(item)}
                        alt={`${item.category} property in ${item.location?.area || 'Bangladesh'}`}
                        eager={index < 10}
                    />
                    <button
                        onClick={toggleSave}
                        className='absolute top-2 right-2 p-2 bg-white/90 rounded-full shadow-sm hover:bg-white hover:scale-110 transition-all duration-300'
                    >
                        {isSaved ? (
                            <FaHeart className='text-red-500 text-lg' />
                        ) : (
                            <FaRegHeart className='text-gray-400 text-lg' />
                        )}
                    </button>
                </div>

                <div className='p-3 space-y-1'>
                    <div className='flex flex-wrap gap-1.5 gap-x-2 text-xs text-gray-600'>
                        <span className='bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-semibold'>
                            Living: {item.living_rooms ?? item.specifications?.living_rooms ?? 0}
                        </span>
                        <span className='bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full'>
                            Bath: {item.total_bathrooms ?? item.specifications?.total_bathrooms ?? 0}
                        </span>

                        {item.balcony > 0 && (
                            <span className='bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full'>
                                Balcony: {item.balcony ?? item.specifications?.balcony ?? item.specifications?.total_balcony ?? 0}
                            </span>
                        )}
                        {item.kitchen > 0 && (
                            <span className='bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full'>
                                Kitchen: {item.kitchen ?? item.specifications?.kitchen ?? 0}
                            </span>
                        )}
                        {item.room_size_sqft && (
                            <span className='bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full'>
                                {item.room_size_sqft} sqft
                            </span>
                        )}
                    </div>

                    <p className='text-gray-800 font-bold text-base'>
                        {item.category || 'Property'}
                    </p>

                    <p className='text-gray-500 text-sm font-medium truncate'>
                        Address: {item.location?.area || ''}, {item.location?.state_district || ''}
                    </p>

                    <p className='text-gray-800 font-bold text-base'>
                        {'৳'}{rentAmount}
                    </p>
                </div>
            </div>
        </Link>
    );
};

export default PropertyListingCard;
