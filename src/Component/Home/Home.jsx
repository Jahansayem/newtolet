 'use client'

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Link, useSearchParams } from 'react-router-dom';
import { listcontext } from '../Route/Listprovaider';
import CategoryFilterBar from './CategoryFilterBar';
import CoverSkeleton from './CoverSkeleton';
import DeferredSection from '../../components/DeferredSection';
import { logCustomerSearch } from '../../services/searchHistoryService';
import { getPublicJobFeedOrders } from '../../services/jobFeedService';
import { HOME_CATEGORIES } from './categoryConfig';
import { matchesKeywordSearch } from './propertySearchCore';
import PropertyListingCard from '../../components/PropertyListingCard';
import { matchesPropertyCategory } from '../../lib/propertyCategories';
import { HOME_CHROME_SCROLL_EVENT } from '../../lib/homeScrollChrome';
import About from './About';
import ArticlePreview from './ArticlePreview';
import { getStoredUser } from '../../services/authService';
import {
    getSavedPropertyIds,
    SAVED_PROPERTIES_BROWSER_EVENT,
} from '../../services/userPanelService';
import {
    COMPARE_PROPERTIES_BROWSER_EVENT,
    getComparedPropertyIds,
} from '../../services/propertyCompareService';

const Cover = dynamic(() => import('./Cover'), {
    loading: () => <CoverSkeleton />,
});
const JobFeedSection = dynamic(() => import('../../components/JobFeedSection'), {
    loading: () => <ContentSectionFallback height='260px' />,
});
const Feedback = dynamic(() => import('./Feadback'));

const CategorySectionsFallback = () => (
    <div className='bg-gray-50 min-h-[720px] py-12 animate-pulse'>
        {HOME_CATEGORIES.map((category) => (
            <div key={category} className='mb-12 space-y-4'>
                <div className='flex items-center justify-between gap-4'>
                    <div className='h-8 w-40 rounded-full bg-gray-200' />
                    <div className='h-5 w-36 rounded-full bg-gray-200' />
                </div>
                <div className='grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6'>
                    {Array.from({ length: 8 }).map((_, index) => (
                        <div key={`${category}-${index}`} className='h-[380px] rounded-[14px] bg-gray-200' />
                    ))}
                </div>
            </div>
        ))}
    </div>
);

const ContentSectionFallback = ({ height = '320px' }) => (
    <div className='py-12 animate-pulse'>
        <div className='h-10 w-64 mx-auto rounded-full bg-gray-200 mb-4' />
        <div className='h-5 w-80 max-w-full mx-auto rounded-full bg-gray-200 mb-10' />
        <div className='rounded-3xl bg-gray-200' style={{ minHeight: height }} />
    </div>
);

const Home = () => {
    const [jobFeedOrders, setJobFeedOrders] = useState([]);
    const [jobFeedLoading, setJobFeedLoading] = useState(true);
    const [searchParams, setSearchParams] = useSearchParams();
    const { isLoading, list } = useContext(listcontext);
    const searchQuery = (searchParams.get('search') || '').trim();
    const lastLoggedSignatureRef = useRef('');
    const sectionRefs = useRef({});
    const stickyBarRef = useRef(null);
    const stickySentinelRef = useRef(null);
    const lastScrollYRef = useRef(0);
    const [activeCategorySection, setActiveCategorySection] = useState(HOME_CATEGORIES[0]);
    const [isCategoryPinned, setIsCategoryPinned] = useState(false);
    const [isHomeNavVisible, setIsHomeNavVisible] = useState(true);
    const [savedPropertyIds, setSavedPropertyIds] = useState([]);
    const [comparedPropertyIds, setComparedPropertyIds] = useState([]);

    // Use refs to track current state values for scroll handler (avoid stale closures)
    const isCategoryPinnedRef = useRef(false);
    const isHomeNavVisibleRef = useRef(true);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
        };
    }, []);

    // Update refs whenever state changes
    useEffect(() => {
        isCategoryPinnedRef.current = isCategoryPinned;
    }, [isCategoryPinned]);

    useEffect(() => {
        isHomeNavVisibleRef.current = isHomeNavVisible;
    }, [isHomeNavVisible]);

    const categorySections = useMemo(() => (
        HOME_CATEGORIES.map((category) => {
            const items = list
                .filter((item) => matchesPropertyCategory(item, category) && matchesKeywordSearch(item, searchQuery))
                .slice(0, 8);

            return { category, items };
        }).filter((section) => section.items.length > 0)
    ), [list, searchQuery]);

    const hasActiveSearch = Boolean(searchQuery);

    // Calculate result count directly from categorySections - no separate state needed
    const resultCount = useMemo(() =>
        categorySections.reduce((total, section) => total + section.items.length, 0),
        [categorySections]
    );

    // Simple search signature for logging - only depends on searchQuery, not resultCount
    const searchSignature = useMemo(() =>
        searchQuery || null,
        [searchQuery]
    );

    useEffect(() => {
        const loadJobFeedOrders = async () => {
            setJobFeedLoading(true);

            try {
                const { data } = await getPublicJobFeedOrders();

                if (isMountedRef.current) {
                    setJobFeedOrders(data || []);
                }
            } finally {
                if (isMountedRef.current) {
                    setJobFeedLoading(false);
                }
            }
        };

        loadJobFeedOrders();

    }, []);

    useEffect(() => {
        const syncSavedProperties = async () => {
            const propertyIds = await getSavedPropertyIds(getStoredUser()?.id || null);

            if (isMountedRef.current) {
                setSavedPropertyIds(propertyIds);
            }
        };

        const syncComparedProperties = () => {
            if (isMountedRef.current) {
                setComparedPropertyIds(getComparedPropertyIds());
            }
        };

        syncComparedProperties();
        void syncSavedProperties();

        window.addEventListener(SAVED_PROPERTIES_BROWSER_EVENT, syncSavedProperties);
        window.addEventListener(COMPARE_PROPERTIES_BROWSER_EVENT, syncComparedProperties);
        window.addEventListener('storage', syncSavedProperties);
        window.addEventListener('storage', syncComparedProperties);
        window.addEventListener('userLogin', syncSavedProperties);
        window.addEventListener('userLogout', syncSavedProperties);

        return () => {
            window.removeEventListener(SAVED_PROPERTIES_BROWSER_EVENT, syncSavedProperties);
            window.removeEventListener(COMPARE_PROPERTIES_BROWSER_EVENT, syncComparedProperties);
            window.removeEventListener('storage', syncSavedProperties);
            window.removeEventListener('storage', syncComparedProperties);
            window.removeEventListener('userLogin', syncSavedProperties);
            window.removeEventListener('userLogout', syncSavedProperties);
        };
    }, []);

    // Only update activeCategorySection when categorySections changes, not when activeCategorySection changes
    useEffect(() => {
        if (!categorySections.length) {
            return;
        }

        // Only update if the current activeCategorySection is no longer valid
        setActiveCategorySection((currentCategory) => (
            categorySections.some((section) => section.category === currentCategory)
                ? currentCategory
                : categorySections[0].category
        ));
    }, [categorySections]);

    // Simplified search logging - only depends on searchQuery and loading state
    // resultCount is read directly inside the effect, not a dependency
    useEffect(() => {
        if (isLoading || !hasActiveSearch) {
            return;
        }

        if (lastLoggedSignatureRef.current === searchSignature) {
            return;
        }

        lastLoggedSignatureRef.current = searchSignature;

        logCustomerSearch({
            searchQuery,
            selectedLocation: null,
            selectedCategory: 'All',
            selectedPriceRange: 'All',
            resultCount,
        });
    }, [
        hasActiveSearch,
        isLoading,
        resultCount,
        searchQuery,
        searchSignature,
    ]);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        const getNavbarOffset = () => (window.innerWidth >= 768 ? 118 : 72);

        // Use refs to track current state and avoid unnecessary setState calls
        let rafId = null;

        const syncHomeChrome = () => {
            // Cancel any pending RAF to avoid stacking updates
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }

            rafId = requestAnimationFrame(() => {
                const sentinelTop = stickySentinelRef.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
                const scrollY = window.scrollY || 0;
                const navbarOffset = getNavbarOffset();
                const pinned = sentinelTop <= navbarOffset;
                const delta = scrollY - lastScrollYRef.current;

                // Read current state from refs to avoid stale closures
                const wasPinned = isCategoryPinnedRef.current;
                const wasVisible = isHomeNavVisibleRef.current;

                // Only update if pinned state actually changed
                if (wasPinned !== pinned) {
                    setIsCategoryPinned(pinned);
                }

                // Calculate next visibility state
                let nextVisible = wasVisible;
                if (!pinned || scrollY <= 16) {
                    nextVisible = true;
                } else if (delta > 4) {
                    nextVisible = false;
                } else if (delta < -4) {
                    nextVisible = true;
                }

                // Only update if visibility actually changed
                if (wasVisible !== nextVisible) {
                    setIsHomeNavVisible(nextVisible);
                }

                lastScrollYRef.current = scrollY;
                rafId = null;
            });
        };

        lastScrollYRef.current = window.scrollY || 0;
        syncHomeChrome();

        window.addEventListener('scroll', syncHomeChrome, { passive: true });
        window.addEventListener('resize', syncHomeChrome);

        return () => {
            window.removeEventListener('scroll', syncHomeChrome);
            window.removeEventListener('resize', syncHomeChrome);
            if (rafId !== null) {
                cancelAnimationFrame(rafId);
            }
            window.dispatchEvent(
                new CustomEvent(HOME_CHROME_SCROLL_EVENT, {
                    detail: {
                        navVisible: true,
                        categoryPinned: false,
                    },
                })
            );
        };
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') {
            return;
        }

        // Always dispatch current state to Navber
        window.dispatchEvent(
            new CustomEvent(HOME_CHROME_SCROLL_EVENT, {
                detail: {
                    navVisible: isHomeNavVisible,
                    categoryPinned: isCategoryPinned,
                },
            })
        );

    }, [isCategoryPinned, isHomeNavVisible]);

    const handleCategoryJump = useCallback((category) => {
        setActiveCategorySection(category);

        const targetSection = sectionRefs.current[category];
        if (!targetSection) {
            return;
        }

        const stickyBarHeight = stickyBarRef.current?.getBoundingClientRect().height || 0;
        const navbarOffset = isCategoryPinned && !isHomeNavVisible
            ? 0
            : (window.innerWidth >= 768 ? 118 : 72);
        const topOffset = navbarOffset + stickyBarHeight + 24;
        const targetTop = targetSection.getBoundingClientRect().top + window.scrollY - topOffset;
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
    }, [isCategoryPinned, isHomeNavVisible]);

    const clearSearch = useCallback(() => {
        const nextSearchParams = new URLSearchParams(searchParams.toString());
        nextSearchParams.delete('search');
        setSearchParams(nextSearchParams);
    }, [searchParams, setSearchParams]);

    const handleSavedPropertiesChange = useCallback((propertyIds) => {
        if (Array.isArray(propertyIds)) {
            setSavedPropertyIds(propertyIds);
        }
    }, []);

    const handleComparedPropertiesChange = useCallback((propertyIds) => {
        if (Array.isArray(propertyIds)) {
            setComparedPropertyIds(propertyIds);
        }
    }, []);

    return (
        <div className='site-shell-wide min-h-screen bg-gray-50 py-6 md:py-8'>
            <div ref={stickySentinelRef} className='h-0 w-full' aria-hidden='true' />
            <div
                ref={stickyBarRef}
                className={`sticky z-40 -mx-4 mb-6 border-b border-gray-200/80 bg-gray-50/95 px-4 py-3 backdrop-blur transition-[top] duration-300 sm:-mx-5 sm:px-5 lg:-mx-8 lg:px-8 ${
                    isCategoryPinned && !isHomeNavVisible
                        ? 'top-0'
                        : 'top-[72px] md:top-[118px]'
                } xl:mx-0 xl:px-0`}
            >
                <CategoryFilterBar
                    selectedCategory={activeCategorySection}
                    onCategorySelect={handleCategoryJump}
                />
            </div>

            <div className='mb-10 md:mb-12'>
                <Cover />
                <div className='px-2 pt-6 text-center'>
                    <p className='text-xs font-bold uppercase tracking-[0.32em] text-gray-900 sm:text-sm md:text-base'>
                        NEW TOLET - Find Homes Smartly
                    </p>
                </div>
            </div>

            <DeferredSection
                className='pb-12'
                fallback={<CategorySectionsFallback />}
                rootMargin='0px 0px 120px 0px'
            >
                <section className='space-y-5'>
                    <div className='mx-auto max-w-3xl text-center'>
                        {/* <p className='site-kicker'>Recently Published Properties</p> */}
                        {/* <h1 className='mt-3 text-balance text-3xl font-bold text-gray-800 md:text-4xl lg:text-[2.8rem]'>
                            Check out the latest property listings
                        </h1> */}
                        {/* <p className='mt-3 text-sm leading-7 text-gray-500 md:text-base'>
                            Browse the newest approved property listings curated across the latest categories.
                        </p> */}
                        {searchQuery && (
                            <div className='mt-5 inline-flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-white'>
                                <span className='text-sm'>Search: {searchQuery}</span>
                                <button
                                    onClick={clearSearch}
                                    className='font-bold text-white/80 hover:text-white'
                                    aria-label='Clear search'
                                >
                                    &times;
                                </button>
                            </div>
                        )}
                    </div>

                    {categorySections.length === 0 ? (
                        <div className='rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center'>
                            <p className='text-lg font-semibold text-gray-700'>No category listings found</p>
                            <p className='mt-2 text-sm text-gray-500'>Try a different search term to browse more properties.</p>
                        </div>
                    ) : (
                        <div className='space-y-12 md:space-y-14'>
                            {categorySections.map(({ category, items }) => (
                                <section
                                    key={category}
                                    ref={(element) => {
                                        sectionRefs.current[category] = element;
                                    }}
                                    className='scroll-mt-[220px] space-y-5'
                                >
                                    <div className='flex flex-col gap-4 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between'>
                                        <div>
                                            <h2 className='text-xl font-bold text-gray-800 md:text-[1.8rem]'>{category}</h2>
                                            <p className='text-sm leading-6 text-gray-500'>Top {items.length} featured {category.toLowerCase()} listings.</p>
                                        </div>
                                        <Link
                                            to={`/propertylist2?category=${encodeURIComponent(category)}`}
                                            className='site-button-secondary text-sm'
                                        >
                                            See more {category.toLowerCase()} property
                                        </Link>
                                    </div>

                                    <div className='grid grid-cols-2 gap-4 gap-y-6 min-[480px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4'>
                                        {items.map((item, index) => (
                                            <PropertyListingCard
                                                key={item.id || `${category}-${index}`}
                                                item={item}
                                                index={index}
                                                savedPropertyIds={savedPropertyIds}
                                                comparedPropertyIds={comparedPropertyIds}
                                                onSavedPropertiesChange={handleSavedPropertiesChange}
                                                onComparedPropertiesChange={handleComparedPropertiesChange}
                                            />
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
                </section>
            </DeferredSection>

            <DeferredSection
                className='px-0 md:px-4 xl:px-8'
                fallback={<ContentSectionFallback height='300px' />}
                rootMargin='0px 0px 120px 0px'
            >
                <ArticlePreview />
            </DeferredSection>

            <JobFeedSection orders={jobFeedOrders} isLoading={jobFeedLoading} />

            <DeferredSection
                className='px-0 md:px-4 xl:px-8'
                fallback={<ContentSectionFallback height='260px' />}
                rootMargin='0px 0px 120px 0px'
            >
                <About />
            </DeferredSection>

            <DeferredSection
                className='px-0 pb-10 md:px-4 xl:px-8'
                fallback={<ContentSectionFallback height='280px' />}
                rootMargin='0px 0px 120px 0px'
            >
                <Feedback />
            </DeferredSection>
        </div>
    );
};

export default Home;
