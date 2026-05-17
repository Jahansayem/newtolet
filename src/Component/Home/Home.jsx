 'use client'

import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Link, useSearchParams } from 'react-router-dom';
import { listcontext } from '../Route/Listprovaider';
import CategoryFilterBar from './CategoryFilterBar';
import Cover from './Cover';
import DeferredSection from '../../components/DeferredSection';
import JobFeedSection from '../../components/JobFeedSection';
import { logCustomerSearch } from '../../services/searchHistoryService';
import { getPublicJobFeedOrders } from '../../services/jobFeedService';
import { HOME_CATEGORIES } from './categoryConfig';
import { matchesKeywordSearch } from './propertySearchCore';
import PropertyListingCard from '../../components/PropertyListingCard';
import { matchesPropertyCategory } from '../../lib/propertyCategories';
import { HOME_CHROME_SCROLL_EVENT } from '../../lib/homeScrollChrome';

const About = dynamic(() => import('./About'));
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
                        <div key={`${category}-${index}`} className='h-64 rounded-2xl bg-gray-200' />
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
    const [resultCount, setResultCount] = useState(0);
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

    const categorySections = useMemo(() => (
        HOME_CATEGORIES.map((category) => {
            const items = list
                .filter((item) => matchesPropertyCategory(item, category) && matchesKeywordSearch(item, searchQuery))
                .slice(0, 8);

            return { category, items };
        }).filter((section) => section.items.length > 0)
    ), [list, searchQuery]);

    const hasActiveSearch = Boolean(searchQuery);

    const searchSignature = useMemo(() => JSON.stringify({
        searchQuery: searchQuery || null,
        resultCount,
    }), [resultCount, searchQuery]);

    useEffect(() => {
        let isMounted = true;

        const loadJobFeedOrders = async () => {
            setJobFeedLoading(true);
            const { data } = await getPublicJobFeedOrders();

            if (isMounted) {
                setJobFeedOrders(data || []);
                setJobFeedLoading(false);
            }
        };

        loadJobFeedOrders();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        setResultCount(categorySections.reduce((total, section) => total + section.items.length, 0));
    }, [categorySections]);

    useEffect(() => {
        if (!categorySections.length) {
            return;
        }

        if (!categorySections.some((section) => section.category === activeCategorySection)) {
            setActiveCategorySection(categorySections[0].category);
        }
    }, [activeCategorySection, categorySections]);

    useEffect(() => {
        if (isLoading || resultCount === null || !hasActiveSearch) {
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

        const syncHomeChrome = () => {
            const sentinelTop = stickySentinelRef.current?.getBoundingClientRect().top ?? Number.POSITIVE_INFINITY;
            const scrollY = window.scrollY || 0;
            const navbarOffset = getNavbarOffset();
            const pinned = sentinelTop <= navbarOffset;
            const delta = scrollY - lastScrollYRef.current;

            setIsCategoryPinned((currentPinned) => (currentPinned === pinned ? currentPinned : pinned));

            setIsHomeNavVisible((currentVisible) => {
                let nextVisible = currentVisible;

                if (!pinned || scrollY <= 16) {
                    nextVisible = true;
                } else if (delta > 4) {
                    nextVisible = false;
                } else if (delta < -4) {
                    nextVisible = true;
                }

                return nextVisible;
            });

            lastScrollYRef.current = scrollY;
        };

        lastScrollYRef.current = window.scrollY || 0;
        syncHomeChrome();

        window.addEventListener('scroll', syncHomeChrome, { passive: true });
        window.addEventListener('resize', syncHomeChrome);

        return () => {
            window.removeEventListener('scroll', syncHomeChrome);
            window.removeEventListener('resize', syncHomeChrome);
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

        window.dispatchEvent(
            new CustomEvent(HOME_CHROME_SCROLL_EVENT, {
                detail: {
                    navVisible: isHomeNavVisible,
                    categoryPinned: isCategoryPinned,
                },
            })
        );
    }, [isCategoryPinned, isHomeNavVisible]);

    const handleCategoryJump = (category) => {
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
    };

    const clearSearch = () => {
        const nextSearchParams = new URLSearchParams(searchParams.toString());
        nextSearchParams.delete('search');
        setSearchParams(nextSearchParams);
    };

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
                                            />
                                        ))}
                                    </div>
                                </section>
                            ))}
                        </div>
                    )}
                </section>
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
