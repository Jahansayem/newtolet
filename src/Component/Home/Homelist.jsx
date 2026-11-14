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
import { PAGE_SIZE } from '../../lib/search/filterOptions.js';
import { useLanguage } from '../../i18n/useLanguage';

const SEARCH_ERROR_FALLBACK_KEY = 'search.results.error';
const EMPTY_SEARCH_RESULT = { properties: [], featured: [], total: 0, pageCount: 0, page: 1, place: null, suggestion: '', emptyQuery: false };

/** Page numbers around the current one: 1 … 4 5 [6] 7 8 … 40 */
const getPageWindow = (page, pageCount) => {
    const pages = new Set([1, pageCount, page - 2, page - 1, page, page + 1, page + 2]);
    const sorted = [...pages].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
    const withGaps = [];
    sorted.forEach((value, index) => {
        if (index > 0 && value - sorted[index - 1] > 1) withGaps.push(`gap-${value}`);
        withGaps.push(value);
    });
    return withGaps;
};

const Pagination = ({ page, pageCount, onPageChange, t }) => {
    if (pageCount <= 1) {
        return null;
    }

    const buttonClass = 'ui-btn ui-btn-secondary ui-btn-sm min-h-11 min-w-11';

    return (
        <nav aria-label={t('search.results.pagination')} className='mt-8 flex flex-col items-center gap-3'>
            <p className='text-caption text-muted'>{t('search.results.pageOf', { page, pages: pageCount })}</p>
            <ul className='flex flex-wrap items-center justify-center gap-1.5'>
                <li>
                    <button type='button' className={buttonClass} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                        {t('search.results.previous')}
                    </button>
                </li>
                {getPageWindow(page, pageCount).map((entry) => (
                    typeof entry === 'string' ? (
                        <li key={entry} aria-hidden='true' className='px-1 text-muted'>…</li>
                    ) : (
                        <li key={entry}>
                            <button
                                type='button'
                                className={`${buttonClass} ${entry === page ? 'ui-btn-primary' : ''}`}
                                aria-current={entry === page ? 'page' : undefined}
                                aria-label={t('search.results.goToPage', { page: entry })}
                                onClick={() => onPageChange(entry)}
                            >
                                {entry}
                            </button>
                        </li>
                    )
                ))}
                <li>
                    <button type='button' className={buttonClass} disabled={page >= pageCount} onClick={() => onPageChange(page + 1)}>
                        {t('search.results.next')}
                    </button>
                </li>
            </ul>
        </nav>
    );
};

const placeLabel = (place, t, tv) => {
    if (!place) return '';
    if (place.type === 'district') return t('search.results.placeDistrict', { name: place.name });
    if (place.type === 'division') return t('search.results.placeDivision', { name: tv('divisions', place.name) });
    return t('search.results.placeArea', { name: place.name });
};

const Homelist = ({
    selectedLocation,
    searchQuery = '',
    maxItems = null,
    onResultsChange = null,
    containerClassName = '',
    gridClassName = 'grid-cols-1 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    categoryOverride = null,
    searchFilters = null,
    page = 1,
    ready = true,
    onPageChange = null,
    onSuggestionSelect = null,
}) => {
    const { t, tv } = useLanguage();
    const { isLoading, list, selectedCategory, selectedPriceRange } = useContext(listcontext);
    const effectiveCategory = categoryOverride || selectedCategory;
    const usesSearchDataSource = Boolean(searchFilters);
    const [searchResult, setSearchResult] = useState(EMPTY_SEARCH_RESULT);
    const [isSearching, setIsSearching] = useState(Boolean(searchFilters));
    // { source: 'live' | 'cache-search' | 'none', errorCode: '' | 'unavailable' | 'failed' }
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

        if (selectedLocation?.division) legacyFilters.division = selectedLocation.division;
        if (selectedLocation?.district) legacyFilters.district = selectedLocation.district;
        if (selectedLocation?.upazilla) legacyFilters.upazilla = selectedLocation.upazilla;
        if (selectedLocation?.subArea) legacyFilters.subArea = selectedLocation.subArea;

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
    const resolvedFilterSignature = useMemo(() => JSON.stringify(resolvedFilters), [resolvedFilters]);

    useEffect(() => {
        if (!usesSearchDataSource || !ready) {
            return undefined;
        }

        let isMounted = true;
        const filtersForRequest = JSON.parse(resolvedFilterSignature);

        const loadSearchResults = async () => {
            setIsSearching(true);
            setSearchStatus({ source: 'live', errorCode: '' });

            try {
                const result = await searchPropertiesWithStatus(filtersForRequest, { page, pageSize: PAGE_SIZE });

                if (isMounted) {
                    setSearchResult({ ...EMPTY_SEARCH_RESULT, ...result });
                    setSearchStatus({ source: result?.source || 'live', errorCode: result?.error?.code || '' });
                }
            } catch (error) {
                if (isMounted) {
                    setSearchResult(EMPTY_SEARCH_RESULT);
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
    }, [resolvedFilterSignature, usesSearchDataSource, retryVersion, page, ready]);

    const handleRetrySearch = () => {
        clearSupabaseConnectionFailureMark();
        setRetryVersion((current) => current + 1);
    };

    const searchFailed = usesSearchDataSource && Boolean(searchStatus.errorCode);

    const legacyList = useMemo(
        () => (usesSearchDataSource ? [] : applyPropertySearch(list, resolvedFilters)),
        [list, resolvedFilters, usesSearchDataSource]
    );

    const visibleList = useMemo(() => {
        if (usesSearchDataSource) {
            return [...searchResult.featured, ...searchResult.properties];
        }

        if (!maxItems || maxItems < 1) {
            return legacyList;
        }

        return legacyList.slice(0, maxItems);
    }, [legacyList, maxItems, searchResult, usesSearchDataSource]);

    const totalCount = usesSearchDataSource ? searchResult.total : legacyList.length;
    const loading = usesSearchDataSource ? isSearching || !ready : isLoading;

    useEffect(() => {
        if (!loading && !searchFailed && typeof onResultsChange === 'function') {
            onResultsChange(totalCount);
        }
    }, [loading, onResultsChange, searchFailed, totalCount]);

    // Split the translated template around {count} so the number keeps its own styling.
    const [foundLabelBefore, foundLabelAfter] = t(usesSearchDataSource ? 'search.results.foundTotal' : 'search.results.found').split('{count}');
    const locale = typeof document !== 'undefined' && document.documentElement.lang === 'bn' ? 'bn-BD' : 'en-US';

    if (loading) {
        return (
            <div className={`${containerClassName} mx-auto pb-8`} aria-busy='true'>
                <p className='sr-only' role='status'>{t('common.loading')}</p>
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

    if (usesSearchDataSource && searchResult.emptyQuery) {
        return (
            <div className={`${containerClassName} mx-auto pb-8`}>
                <EmptyState title={t('search.results.none')} description={t('search.results.punctuationOnly')} />
            </div>
        );
    }

    const showStatusLine = (hasActiveFilters || maxItems || usesSearchDataSource) && !(searchFailed && visibleList.length === 0);
    const place = usesSearchDataSource ? placeLabel(searchResult.place, t, tv) : '';

    return (
        <div className={`${containerClassName} mx-auto pb-8`}>
            {showStatusLine && (
                <div className='py-3' role='status' aria-live='polite'>
                    <p className='text-caption text-muted'>
                        {foundLabelBefore}<span className='font-semibold text-ink'>{totalCount.toLocaleString(locale)}</span>{foundLabelAfter}
                        {place ? ` · ${t('search.results.showingPlace', { place })}` : ''}
                        {!place && resolvedFilters.upazilla ? t('search.results.inLocation', { location: resolvedFilters.upazilla }) : ''}
                        {!place && !resolvedFilters.upazilla && resolvedFilters.district ? t('search.results.inLocation', { location: resolvedFilters.district }) : ''}
                        {!place && !resolvedFilters.upazilla && !resolvedFilters.district && resolvedFilters.division ? t('search.results.inLocation', { location: tv('divisions', resolvedFilters.division) }) : ''}
                        {resolvedFilters.category && resolvedFilters.category !== 'All' ? t('search.results.inCategory', { category: tv('categories', resolvedFilters.category) }) : ''}
                        {maxItems && legacyList.length > maxItems ? t('search.results.showingFirst', { count: maxItems }) : ''}
                    </p>
                </div>
            )}

            {searchFailed && visibleList.length === 0 && (
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

            {searchFailed && visibleList.length > 0 && (
                <div role='status' className='ui-note mb-4 flex flex-wrap items-center justify-between gap-3'>
                    <span>{t('search.results.cachedNotice')}</span>
                    <button type='button' onClick={handleRetrySearch} className='ui-btn ui-btn-secondary ui-btn-sm'>
                        {t('common.retry')}
                    </button>
                </div>
            )}

            {!searchFailed && visibleList.length === 0 && (
                <EmptyState
                    title={hasActiveFilters ? t('search.results.none') : t('search.results.noneUnfiltered')}
                    description={hasActiveFilters ? t('search.results.noneHint') : t('search.results.noneUnfilteredHint')}
                    action={searchResult.suggestion && onSuggestionSelect ? (
                        <p className='text-sm'>
                            {t('search.results.didYouMean')}{' '}
                            <button
                                type='button'
                                onClick={() => onSuggestionSelect(searchResult.suggestion)}
                                className='font-semibold text-brand underline underline-offset-2'
                            >
                                {searchResult.suggestion}
                            </button>
                            ?
                        </p>
                    ) : null}
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

            {usesSearchDataSource && typeof onPageChange === 'function' ? (
                <Pagination page={searchResult.page || page} pageCount={searchResult.pageCount} onPageChange={onPageChange} t={t} />
            ) : null}
            {usesSearchDataSource && searchResult.pageCount > 0 && (searchResult.page || page) >= searchResult.pageCount && visibleList.length > 0 ? (
                <p className='mt-4 text-center text-caption text-muted'>{t('search.results.endOfResults')}</p>
            ) : null}
        </div>
    );
};

export default Homelist;
