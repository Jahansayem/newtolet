 'use client'

import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Link, useNavigate } from 'react-router-dom';
import { useDeferredSearchParams } from '../../lib/useDeferredSearchParams.jsx';
import { listcontext } from '../Route/Listprovaider';
import CategoryFilterBar from './CategoryFilterBar';
import CoverSkeleton from './CoverSkeleton';
import DeferredSection from '../../components/DeferredSection';
import { logCustomerSearch } from '../../services/searchHistoryService';
import { getPublicJobFeedOrders } from '../../services/jobFeedService';
import { HOME_CATEGORIES } from './categoryConfig';
import { matchesKeywordSearch } from './propertySearchCore';
import PropertyListingCard from '../../components/PropertyListingCard';
import ListingCardSkeleton from '../../components/ListingCardSkeleton';
import HomeHero from './HomeHero';
import { matchesPropertyCategory } from '../../lib/propertyCategories';
import { HOME_CHROME_SCROLL_EVENT, getNavHeight } from '../../lib/homeScrollChrome';
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
import AdsterraBanner from './Ads';
import { buildCategoryPagePath } from '../../lib/seo/categoryPages.js';
import { useLanguage } from '../../i18n/useLanguage';

const Cover = dynamic(
    () => import('./Cover').then((mod) => mod.default),
    {
        loading: () => <CoverSkeleton />,
    }
);
const JobFeedSection = dynamic(
    () => import('../../components/JobFeedSection').then((mod) => mod.default),
    {
        loading: () => <ContentSectionFallback height='260px' />,
    }
);
const Feedback = dynamic(
    () => import('./Feadback').then((mod) => mod.default),
    {
        // Own fallback so a cold chunk never suspends up to the page-level skeleton.
        loading: () => <ContentSectionFallback height='280px' />,
    }
);

const CategorySectionsFallback = () => (
    <div className='min-h-[720px] py-2' aria-hidden='true'>
        {HOME_CATEGORIES.map((category) => (
            <div key={category} className='mb-12 space-y-5'>
                <div className='animate-pulse border-b border-line pb-4'>
                    <div className='h-7 w-40 rounded-md bg-slate-200' />
                    <div className='mt-2 h-4 w-48 rounded-md bg-slate-200' />
                </div>
                {/* Same grid and card proportions as the real section so content does not shift in. */}
                <div className='grid grid-cols-1 gap-4 gap-y-6 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'>
                    {Array.from({ length: 4 }).map((_, index) => (
                        <ListingCardSkeleton key={`${category}-${index}`} />
                    ))}
                </div>
            </div>
        ))}
    </div>
);

const ContentSectionFallback = ({ height = '320px' }) => (
    <div className='py-12 animate-pulse' aria-hidden='true'>
        <div className='h-8 w-64 mx-auto rounded-md bg-slate-200 mb-4' />
        <div className='h-4 w-80 max-w-full mx-auto rounded-md bg-slate-200 mb-10' />
        <div className='rounded-[var(--radius-panel)] bg-slate-200' style={{ minHeight: height }} />
    </div>
);

const Home = () => {
    const { t, tv } = useLanguage();
    const [jobFeedOrders, setJobFeedOrders] = useState([]);
    const [jobFeedLoading, setJobFeedLoading] = useState(true);
    // Deferred: the hero, H1 and sections render into the static HTML; ?search= arrives after hydration.
    const [searchParams, searchParamsBridge] = useDeferredSearchParams();
    const navigate = useNavigate();
    const { isLoading, list, refreshProperties } = useContext(listcontext);
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

        const getNavbarOffset = () => getNavHeight();

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
            : getNavHeight();
        const topOffset = navbarOffset + stickyBarHeight + 24;
        const targetTop = targetSection.getBoundingClientRect().top + window.scrollY - topOffset;
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
    }, [isCategoryPinned, isHomeNavVisible]);

    const clearSearch = useCallback(() => {
        const nextSearchParams = new URLSearchParams(searchParams.toString());
        nextSearchParams.delete('search');
        const query = nextSearchParams.toString();
        navigate(query ? `/?${query}` : '/', { replace: true });
    }, [navigate, searchParams]);

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
        <div className='site-shell site-shell-full min-h-screen pb-5 pt-2 md:pb-6 md:pt-3 lg:px-25'>
            {searchParamsBridge}
            <div ref={stickySentinelRef} className='h-0 w-full' aria-hidden='true' />
            <div
                ref={stickyBarRef}
                className={`site-shell-bleed sticky z-40 mb-6 border-b border-line/80 bg-canvas/95 py-2.5 backdrop-blur transition-[top] duration-300 ${
                    isCategoryPinned && !isHomeNavVisible
                        ? 'top-0'
                        : 'top-[var(--nav-h)]'
                }`}
            >
                <CategoryFilterBar
                    selectedCategory={activeCategorySection}
                    onCategorySelect={handleCategoryJump}
                    mode='jump'
                />
            </div>

            <div className='mb-12 space-y-6 md:mb-16'>
                <Cover />
                <HomeHero />
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
                            <div className='mb-6 inline-flex max-w-full flex-wrap items-center justify-center gap-1 rounded-full bg-ink py-1 pl-4 pr-1 text-white'>
                                <span className='text-sm'>{t('home.searchBadge', { query: searchQuery })}</span>
                                <button
                                    type='button'
                                    onClick={clearSearch}
                                    className='flex h-9 w-9 items-center justify-center rounded-full text-white/80 hover:bg-white/15 hover:text-white'
                                    aria-label={t('home.clearSearch')}
                                >
                                    &times;
                                </button>
                            </div>
                        )}
                    </div>

                    {categorySections.length === 0 && isLoading ? (
                        <CategorySectionsFallback />
                    ) : categorySections.length === 0 ? (
                        <div role='status' className='rounded-[var(--radius-panel)] border border-dashed border-line bg-canvas px-6 py-14 text-center'>
                            <p className='text-lg font-semibold text-ink'>{t('home.noCategoryListings')}</p>
                            <p className='mt-2 text-caption text-muted'>{t('home.noCategoryListingsHint')}</p>
                            {typeof refreshProperties === 'function' ? (
                                <button type='button' onClick={refreshProperties} className='ui-btn ui-btn-secondary ui-btn-sm mt-5'>
                                    {t('common.retry')}
                                </button>
                            ) : null}
                        </div>
                    ) : (
                        <div className='space-y-12 md:space-y-16'>
                            {categorySections.map(({ category, items }) => (
                                <section
                                    key={category}
                                    ref={(element) => {
                                        sectionRefs.current[category] = element;
                                    }}
                                    className='scroll-mt-[calc(var(--nav-h)+5.5rem)] space-y-5'
                                >
                                    <div className='flex flex-wrap items-end justify-between gap-3 border-b border-line pb-4'>
                                        <div>
                                            <h2 className='text-2xl font-bold leading-8 text-ink md:text-[26px]'>{tv('categories', category)}</h2>
                                            <p className='mt-0.5 text-caption text-muted'>{t('home.categorySummary', { count: items.length, category: tv('categories', category).toLowerCase() })}</p>
                                        </div>
                                        <Link
                                            to={buildCategoryPagePath(category)}
                                            className='ui-btn ui-btn-ghost ui-btn-sm -mr-2 hidden text-brand sm:inline-flex'
                                        >
                                            {t('home.seeMoreCategory', { category: tv('categories', category).toLowerCase() })}
                                        </Link>
                                    </div>

                                    <div className='grid grid-cols-1 gap-4 gap-y-6 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'>
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

                                    <div className='flex justify-center pt-1 sm:hidden'>
                                        <Link
                                            to={buildCategoryPagePath(category)}
                                            className='ui-btn ui-btn-secondary ui-btn-sm'
                                        >
                                            {t('home.seeMoreCategory', { category: tv('categories', category).toLowerCase() })}
                                        </Link>
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
                className='px-0  md:px-4 xl:px-8'
                fallback={<ContentSectionFallback height='180px' />}
                rootMargin='0px 0px 120px 0px'
                mountAfterMs={null}
            >
                <AdsterraBanner></AdsterraBanner>
            </DeferredSection>

            <DeferredSection
                className='px-0 pb-10 md:px-4 xl:px-8'
                fallback={<ContentSectionFallback height='280px' />}
                rootMargin='0px 0px 120px 0px'
            >
                <Feedback />
            </DeferredSection>
             <DeferredSection
                className='px-0  md:px-4 xl:px-8'
                fallback={<ContentSectionFallback height='180px' />}
                rootMargin='0px 0px 120px 0px'
                mountAfterMs={null}
            >
                <AdsterraBanner></AdsterraBanner>
            </DeferredSection>
        </div>
    );
};

export default Home;
