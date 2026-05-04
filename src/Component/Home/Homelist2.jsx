import React, { useContext, useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { listcontext } from '../Route/Listprovaider';
import { FaRegHeart, FaHeart } from 'react-icons/fa';
import PropertyCardMedia from '../../components/PropertyCardMedia';
import { buildListDetailsHref } from '../../lib/routePaths';
import { getStoredUser } from '../../services/authService';
import {
    getSavedPropertyIds,
    toggleSavedProperty,
    SAVED_PROPERTIES_BROWSER_EVENT,
} from '../../services/userPanelService';
import { matchesPropertyCategory } from '../../lib/propertyCategories';
import RentDisplay from '../../components/RentDisplay';

const getCardImageSource = (item) =>
    item?.primary_image ||
    item?.images?.find((image) => typeof image === 'string' && image.trim()) ||
    (typeof item?.image_url === 'string' && item.image_url.trim() ? item.image_url.trim() : null);

const Homelist2 = ({ locationFilter }) => {
    const { list, selectedCategory } = useContext(listcontext)
    const [savedProperties, setSavedProperties] = useState([])

    useEffect(() => {
        const loadSavedProperties = async () => {
            const savedPropertyIds = await getSavedPropertyIds(getStoredUser()?.id || null)
            setSavedProperties(savedPropertyIds)
        }

        void loadSavedProperties()
        window.addEventListener(SAVED_PROPERTIES_BROWSER_EVENT, loadSavedProperties)
        window.addEventListener('userLogin', loadSavedProperties)
        window.addEventListener('userLogout', loadSavedProperties)

        return () => {
            window.removeEventListener(SAVED_PROPERTIES_BROWSER_EVENT, loadSavedProperties)
            window.removeEventListener('userLogin', loadSavedProperties)
            window.removeEventListener('userLogout', loadSavedProperties)
        }
    }, [])

    // Filter list based on selected category and location
    // Memoized to prevent recalculation on every render
    const filteredList = useMemo(() => {
        return list.filter(item => {
            // Category filter
            const categoryMatch = matchesPropertyCategory(item, selectedCategory)

            // Location filter
            let locationMatch = true
            if (locationFilter) {
                const itemArea = (item.location?.area || '').toLowerCase()
                const itemDistrict = (item.location?.state_district || '').toLowerCase()
                const itemDivision = (item.location?.division || '').toLowerCase()

                // Check if property matches any level of selected location
                if (locationFilter.upazilla) {
                    locationMatch = itemArea.includes(locationFilter.upazilla.toLowerCase()) ||
                                   itemDistrict.includes(locationFilter.district?.toLowerCase() || '') ||
                                   itemDivision.includes(locationFilter.division?.toLowerCase() || '')
                } else if (locationFilter.district) {
                    locationMatch = itemDistrict.includes(locationFilter.district.toLowerCase()) ||
                                   itemDivision.includes(locationFilter.division?.toLowerCase() || '')
                } else if (locationFilter.division) {
                    locationMatch = itemDivision.includes(locationFilter.division.toLowerCase())
                }
            }

            return categoryMatch && locationMatch
        })
    }, [list, selectedCategory, locationFilter]);

    // Toggle save property
    const toggleSave = async (e, propertyId) => {
        e.preventDefault()
        e.stopPropagation()

        const result = await toggleSavedProperty(getStoredUser()?.id || null, propertyId)
        setSavedProperties(result?.propertyIds || [])
    }

    return (
        <div className='max-w-7xl mx-auto bg-gray-50 pb-8'>
            {/* Active Location Filter Indicator */}
            {locationFilter && (
                <div className='mb-4 px-4 py-2 bg-[#1E73B8]/10 rounded-lg flex items-center justify-between'>
                    <span className='text-sm text-[#1E73B8] font-medium'>
                        Filtering by:
                        {locationFilter.upazilla && ` ${locationFilter.upazilla}`}
                        {locationFilter.district && !locationFilter.upazilla && ` ${locationFilter.district}`}
                        {locationFilter.division && !locationFilter.district && !locationFilter.upazilla && ` ${locationFilter.division}`}
                        {locationFilter.division && (locationFilter.district || locationFilter.upazilla) && `, ${locationFilter.division}`}
                    </span>
                </div>
            )}
            <div className='grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4 gap-y-6'>
                {
                    filteredList.slice(0, 20).map((item, index) => (
                        <Link to={buildListDetailsHref(item.id)} key={index}>
                            <div className='bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 overflow-hidden'>
                                {/* Image section */}
                                <div className='relative'>
                                    <PropertyCardMedia
                                        src={getCardImageSource(item)}
                                        alt={`${item.category} property in ${item.location?.area || 'Bangladesh'}`}
                                        eager={index < 10}
                                        propertyType={item.property_type}
                                        category={item.category}
                                        pricing={item.pricing}
                                    />
                                    {/* Heart icon */}
                                    <button
                                        onClick={(e) => toggleSave(e, item.id)}
                                        className='absolute top-2 right-2 p-2 bg-white/90 rounded-full shadow-sm hover:bg-white hover:scale-110 transition-all duration-300'
                                    >
                                        {savedProperties.includes(item.id) ? (
                                            <FaHeart className='text-red-500 text-lg' />
                                        ) : (
                                            <FaRegHeart className='text-gray-400 text-lg' />
                                        )}
                                    </button>
                                </div>

                                {/* Content section */}
                                <div className='p-3 space-y-1 '>
                                    {/* Property ID */}
                                    {item.property_id_number && (
                                        <p className='text-[#1E73B8] text-xs font-bold'>
                                            #{item.property_id_number}
                                        </p>
                                    )}
                                    {/* Room & Bath count */}
                                    <p className='text-gray-500 text-sm'>
                                        Room: {item.specifications?.total_rooms || 0} Bath: {item.specifications?.total_bathrooms || 0}
                                    </p>

                                    {/* Divider */}
                                    <hr className='border-gray-200' />

                                    {/* Category Title */}
                                    <p className='text-gray-800 font-bold text-base'>
                                        {item.category || 'Property'}
                                    </p>

                                    {/* Address */}
                                    <p className='text-gray-500 text-sm font-medium  truncate'>
                                        Address: {item.location?.area || ''}, {item.location?.state_district || ''}
                                    </p>

                                    {/* Posted Date */}
                                    {item.availability?.available_from && (
                                        <p className='text-gray-500 text-sm font-medium '>
                                            Posted: {new Date(item.availability.available_from).toLocaleString('default', { month: 'long' })}
                                        </p>
                                    )}

                                    {/* Price */}
                                    <p className='text-gray-800 font-bold text-base'>
                                        <RentDisplay pricing={item.pricing} prefix='৳' />
                                    </p>
                                </div>
                            </div>
                        </Link>
                    ))
                }
            </div>
        </div>
    );
};

export default Homelist2;
