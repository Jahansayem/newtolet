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
import { matchesPropertySearch } from './propertySearch';
import PropertyListingCard from '../../components/PropertyListingCard';

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
                    {Array.from({ length: 6 }).map((_, index) => (
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
    const [activeCategorySection, setActiveCategorySection] = useState(HOME_CATEGORIES[0]);

    const categorySections = useMemo(() => (
        HOME_CATEGORIES.map((category) => {
            const items = list
                .filter((item) => item.category === category && matchesPropertySearch(item, searchQuery))
                .slice(0, 6);

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

    const handleCategoryJump = (category) => {
        setActiveCategorySection(category);

        const targetSection = sectionRefs.current[category];
        if (!targetSection) {
            return;
        }

        const topOffset = window.innerWidth >= 768 ? 190 : 150;
        const targetTop = targetSection.getBoundingClientRect().top + window.scrollY - topOffset;
        window.scrollTo({ top: targetTop, behavior: 'smooth' });
    };

    const clearSearch = () => {
        const nextSearchParams = new URLSearchParams(searchParams.toString());
        nextSearchParams.delete('search');
        setSearchParams(nextSearchParams);
    };

    return (
        <div className='min-h-screen max-w-[1250px] mx-auto bg-gray-50 px-3 py-8 md:px-6 xl:px-0'>
            <div className='sticky top-[72px] z-40 -mx-3 mb-6 border-b border-gray-200/80 bg-gray-50/95 px-3 py-3 backdrop-blur md:top-[118px] md:-mx-6 md:px-6 xl:mx-0 xl:px-0'>
                <CategoryFilterBar
                    selectedCategory={activeCategorySection}
                    onCategorySelect={handleCategoryJump}
                />
            </div>

            <div className='mb-10'>
                <Cover />
                <div className='px-4 pt-6 text-center'>
                    <p className='text-sm font-bold uppercase tracking-[0.35em] text-gray-900 sm:text-base md:text-lg'>
                        NEW TOLET - HOUSE RENT SOLUTION
                    </p>
                </div>
            </div>

            <JobFeedSection orders={jobFeedOrders} isLoading={jobFeedLoading} />

            <DeferredSection
                className='pb-12'
                fallback={<CategorySectionsFallback />}
                rootMargin='0px 0px 120px 0px'
            >
                <section className='space-y-4'>
                    <div className='text-center'>
                        <p className='text-xs font-semibold uppercase tracking-[0.35em] text-[#1E73B8]'>Recently Published Properties</p>
                        <h1 className='mt-3 text-3xl font-bold text-gray-800 md:text-4xl'>Check out the latest property listings</h1>
                        <p className='mt-2 text-sm text-gray-500 md:text-base'>
                            Browse the newest approved property listings below the job feed.
                        </p>
                        {searchQuery && (
                            <div className='mt-4 inline-flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2 text-white'>
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
                        <div className='space-y-14'>
                            {categorySections.map(({ category, items }) => (
                                <section
                                    key={category}
                                    ref={(element) => {
                                        sectionRefs.current[category] = element;
                                    }}
                                    className='scroll-mt-[220px] space-y-5'
                                >
                                    <div className='flex flex-col gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between'>
                                        <div>
                                            <h2 className='text-2xl font-bold text-gray-800'>{category}</h2>
                                            <p className='text-sm text-gray-500'>Top {items.length} featured {category.toLowerCase()} listings.</p>
                                        </div>
                                        <Link
                                            to={`/propertylist2?category=${encodeURIComponent(category)}`}
                                            className='inline-flex items-center justify-center rounded-full border border-[#1E73B8] px-5 py-2 text-sm font-semibold text-[#1E73B8] transition-colors hover:bg-[#1E73B8] hover:text-white'
                                        >
                                            See more {category.toLowerCase()} property
                                        </Link>
                                    </div>

                                    <div className='grid grid-cols-2 gap-4 gap-y-8 md:grid-cols-3 xl:grid-cols-6'>
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
