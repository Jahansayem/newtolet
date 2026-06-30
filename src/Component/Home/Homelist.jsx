import React, { useContext, useEffect, useMemo } from 'react';
import { listcontext } from '../Route/Listprovaider';
import PropertyListingCard from '../../components/PropertyListingCard';
import {
    DEFAULT_SEARCH_FILTERS,
    applyPropertySearch,
    hasActiveSearchFilters,
} from './propertySearch';

const Homelist = ({
    selectedLocation,
    searchQuery = '',
    maxItems = null,
    onResultsChange = null,
    containerClassName = 'max-w-7xl',
    gridClassName = 'grid-cols-1 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5',
    categoryOverride = null,
    searchFilters = null,
}) => {
    const { isLoading, list, selectedCategory, selectedPriceRange } = useContext(listcontext);
    const effectiveCategory = categoryOverride || selectedCategory;

    const resolvedFilters = useMemo(() => {
        if (searchFilters) {
            return {
                ...DEFAULT_SEARCH_FILTERS,
                ...searchFilters,
            };
        }

        const legacyFilters = {
            ...DEFAULT_SEARCH_FILTERS,
            search: searchQuery,
            category: effectiveCategory,
            sort: 'newest',
        };

        if (selectedLocation?.division) {
            legacyFilters.division = selectedLocation.division;
        }

        if (selectedLocation?.district) {
            legacyFilters.district = selectedLocation.district;
        }

        if (selectedLocation?.upazilla) {
            legacyFilters.upazilla = selectedLocation.upazilla;
        }

        if (selectedLocation?.subArea) {
            legacyFilters.subArea = selectedLocation.subArea;
        }

        if (selectedPriceRange === 'Low') {
            legacyFilters.minPrice = '5000';
            legacyFilters.maxPrice = '11000';
        } else if (selectedPriceRange === 'Mid') {
            legacyFilters.minPrice = '12000';
            legacyFilters.maxPrice = '18000';
        } else if (selectedPriceRange === 'High') {
            legacyFilters.minPrice = '19000';
        }

        return legacyFilters;
    }, [effectiveCategory, searchFilters, searchQuery, selectedLocation, selectedPriceRange]);

    const hasActiveFilters = hasActiveSearchFilters(resolvedFilters);

    const filteredList = useMemo(() => {
        return applyPropertySearch(list, resolvedFilters);
    }, [list, resolvedFilters]);

    const visibleList = useMemo(() => {
        if (!maxItems || maxItems < 1) {
            return filteredList;
        }

        return filteredList.slice(0, maxItems);
    }, [filteredList, maxItems]);

    useEffect(() => {
        if (!isLoading && typeof onResultsChange === 'function') {
            onResultsChange(filteredList.length);
        }
    }, [filteredList.length, isLoading, onResultsChange]);

    if (isLoading) {
        return (
            <div className={`${containerClassName} mx-auto bg-gray-50 pb-8`}>
                <div className='text-center py-4'>
                    <div className='mx-auto h-5 w-48 animate-pulse rounded-full bg-gray-200' />
                </div>
                <div className={`grid ${gridClassName} gap-4 gap-y-6 md:gap-5 md:gap-y-8`}>
                    {Array.from({ length: maxItems || 10 }).map((_, index) => (
                        <div
                            key={index}
                            className='h-[390px] animate-pulse rounded-[14px] bg-white shadow-sm'
                        >
                            <div className='h-[210px] rounded-t-[14px] bg-gray-200' />
                            <div className='space-y-3 p-3'>
                                <div className='h-4 w-20 rounded-full bg-gray-200' />
                                <div className='h-4 w-28 rounded-full bg-gray-200' />
                                <div className='h-5 w-32 rounded-full bg-gray-200' />
                                <div className='h-4 w-full rounded-full bg-gray-200' />
                                <div className='h-5 w-24 rounded-full bg-gray-200' />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={`${containerClassName} mx-auto bg-gray-50 pb-8`}>
            {(hasActiveFilters || maxItems) && (
                <div className='text-center py-4'>
                    <p className='text-gray-600 text-sm'>
                        Found <span className='font-bold text-[#1E73B8]'>{filteredList.length}</span> properties
                        {resolvedFilters.upazilla ? ` in ${resolvedFilters.upazilla}` : ''}
                        {!resolvedFilters.upazilla && resolvedFilters.district ? ` in ${resolvedFilters.district}` : ''}
                        {!resolvedFilters.upazilla && !resolvedFilters.district && resolvedFilters.division ? ` in ${resolvedFilters.division}` : ''}
                        {resolvedFilters.category && resolvedFilters.category !== 'All' ? ` in ${resolvedFilters.category}` : ''}
                        {resolvedFilters.search ? ` for "${resolvedFilters.search}"` : ''}
                        {maxItems && filteredList.length > maxItems ? `, showing first ${maxItems}` : ''}
                    </p>
                </div>
            )}

            {filteredList.length === 0 && hasActiveFilters && (
                <div className='text-center py-12'>
                    <p className='text-gray-500 text-lg'>No properties found</p>
                    <p className='text-gray-400 text-sm mt-2'>
                        Try a different search term, category, price range, or location
                    </p>
                </div>
            )}

            <div className={`grid ${gridClassName} gap-4 gap-y-6 md:gap-5 md:gap-y-8`}>
                {visibleList.map((item, index) => (
                    <PropertyListingCard
                        key={item.id || index}
                        item={item}
                        index={index}
                    />
                ))}
            </div>
        </div>
    );
};

export default Homelist;
