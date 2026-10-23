import React, { useContext, useEffect, useMemo, useState } from 'react';
import { listcontext } from '../Route/Listprovaider';
import PropertyListingCard from '../../components/PropertyListingCard';
import ListingCardSkeleton from '../../components/ListingCardSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import { searchPropertiesWithStatus } from '../../services/propertyCatalogService';
import { clearSupabaseConnectionFailureMark } from '../../services/supabaseClient';
import {
    DEFAULT_SEARCH_FILTERS,
    applyPropertySearch,
    hasActiveSearchFilters,
} from './propertySearch';
import { useLanguage } from '../../i18n/useLanguage';

const SEARCH_ERROR_FALLBACK_KEY = 'search.results.error';

const Homelist = ({
    selectedLocation,
    searchQuery = '',
    maxItems = null,
    onResultsChange = null,
    containerClassName = '',
    gridClassName = 'grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    categoryOverride = null,
    searchFilters = null,
}) => {
    const { t, tv } = useLanguage();
    const { isLoading, list, selectedCategory, selectedPriceRange } = useContext(listcontext);
    const effectiveCategory = categoryOverride || selectedCategory;
    const usesSearchDataSource = Boolean(searchFilters);
    const [searchedList, setSearchedList] = useState([]);
    const [isSearching, setIsSearching] = useState(Boolean(searchFilters));
    // { source: 'live' | 'cache-search' | 'cache-all' | 'none', errorCode: '' | 'unavailable' | 'failed' }
    const [searchStatus, setSearchStatus] = useState({ source: 'live', errorCode: '' });
    const [retryVersion, setRetryVersion] = useState(0);

    // In search mode the filters come only from the URL-driven prop; context values must not
    // feed in, otherwise a category click re-ran the search twice (prop change + context sync).
    const searchModeFilters = useMemo(
        () => (searchFilters ? { ...DEFAULT_SEARCH_FILTERS, ...searchFilters } : null),
        [searchFilters]
    );

    const legacyFilters = useMemo(() => {
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
    }, [effectiveCategory, searchQuery, selectedLocation, selectedPriceRange]);

    const resolvedFilters = searchModeFilters || legacyFilters;

    const hasActiveFilters = hasActiveSearchFilters(resolvedFilters);
    const resolvedFilterSignature = useMemo(
        () => JSON.stringify(resolvedFilters),
        [resolvedFilters]
    );

    useEffect(() => {
        if (!usesSearchDataSource) {
            return undefined;
        }

        let isMounted = true;
        const filtersForRequest = JSON.parse(resolvedFilterSignature);

        const loadSearchResults = async () => {
            setIsSearching(true);
            setSearchStatus({ source: 'live', errorCode: '' });

            try {
                const result = await searchPropertiesWithStatus(filtersForRequest);

                if (isMounted) {
                    setSearchedList(Array.isArray(result?.properties) ? result.properties : []);
                    setSearchStatus({
                        source: result?.source || 'live',
                        errorCode: result?.error?.code || '',
                    });
                }
            } catch (error) {
                if (isMounted) {
                    setSearchedList([]);
                    setSearchStatus({ source: 'none', errorCode: error?.message || 'failed' });
                }
            } finally {
                if (isMounted) {
                    setIsSearching(false);
                }
            }
        };

        void loadSearchResults();

        return () => {
            isMounted = false;
        };
    }, [resolvedFilterSignature, usesSearchDataSource, retryVersion]);

    const handleRetrySearch = () => {
        clearSupabaseConnectionFailureMark();
        setRetryVersion((current) => current + 1);
    };

    const searchFailed = usesSearchDataSource && Boolean(searchStatus.errorCode);

    const filteredList = useMemo(() => {
        if (usesSearchDataSource) {
            return searchedList;
        }

        return applyPropertySearch(list, resolvedFilters);
    }, [list, resolvedFilters, searchedList, usesSearchDataSource]);

    const visibleList = useMemo(() => {
        if (!maxItems || maxItems < 1) {
            return filteredList;
        }

        return filteredList.slice(0, maxItems);
    }, [filteredList, maxItems]);

    useEffect(() => {
        const loading = usesSearchDataSource ? isSearching : isLoading;

        if (!loading && !searchFailed && typeof onResultsChange === 'function') {
            onResultsChange(filteredList.length);
        }
    }, [filteredList.length, isLoading, isSearching, onResultsChange, searchFailed, usesSearchDataSource]);

    // Split the translated template around {count} so the number keeps its own styling.
    const [foundLabelBefore, foundLabelAfter] = t('search.results.found').split('{count}');


    if (usesSearchDataSource ? isSearching : isLoading) {
        return (
            <div className={`${containerClassName} mx-auto pb-8`} aria-busy='true'>
                <div className='py-4 text-center'>
                    <div className='mx-auto h-5 w-48 animate-pulse rounded-md bg-slate-200' />
                </div>
                <div className={`grid ${gridClassName} gap-4 gap-y-6 md:gap-5 md:gap-y-8`}>
                    {Array.from({ length: maxItems || 8 }).map((_, index) => (
                        <ListingCardSkeleton key={index} />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className={`${containerClassName} mx-auto pb-8`}>
            {(hasActiveFilters || maxItems) && !(searchFailed && filteredList.length === 0) && (
                <div className='py-3' role='status' aria-live='polite'>
                    <p className='text-caption text-muted'>
                        {foundLabelBefore}<span className='font-semibold text-ink'>{filteredList.length}</span>{foundLabelAfter}
                        {resolvedFilters.upazilla ? t('search.results.inLocation', { location: resolvedFilters.upazilla }) : ''}
                        {!resolvedFilters.upazilla && resolvedFilters.district ? t('search.results.inLocation', { location: resolvedFilters.district }) : ''}
                        {!resolvedFilters.upazilla && !resolvedFilters.district && resolvedFilters.division ? t('search.results.inLocation', { location: tv('divisions', resolvedFilters.division) }) : ''}
                        {resolvedFilters.category && resolvedFilters.category !== 'All' ? t('search.results.inCategory', { category: tv('categories', resolvedFilters.category) }) : ''}
                        {resolvedFilters.search ? t('search.results.forKeyword', { query: resolvedFilters.search }) : ''}
                        {maxItems && filteredList.length > maxItems ? t('search.results.showingFirst', { count: maxItems }) : ''}
                    </p>
                </div>
            )}

            {searchFailed && filteredList.length === 0 && (
                <EmptyState
                    role='alert'
                    title={t(SEARCH_ERROR_FALLBACK_KEY)}
                    description={t('search.results.errorHint')}
                    action={(
                        <button type='button' onClick={handleRetrySearch} className='ui-btn ui-btn-secondary ui-btn-sm'>
                            {t('common.retry')}
                        </button>
                    )}
                />
            )}

            {searchFailed && filteredList.length > 0 && (
                <div role='status' className='ui-note mb-4 flex flex-wrap items-center justify-between gap-3'>
                    <span>{t('search.results.cachedNotice')}</span>
                    <button type='button' onClick={handleRetrySearch} className='ui-btn ui-btn-secondary ui-btn-sm'>
                        {t('common.retry')}
                    </button>
                </div>
            )}

            {!searchFailed && filteredList.length === 0 && (
                <EmptyState
                    title={hasActiveFilters ? t('search.results.none') : t('search.results.noneUnfiltered')}
                    description={hasActiveFilters ? t('search.results.noneHint') : t('search.results.noneUnfilteredHint')}
                />
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
