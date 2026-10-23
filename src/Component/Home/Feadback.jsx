import React, { useEffect, useRef, useState } from 'react';
import { FaQuoteLeft } from 'react-icons/fa';
import { getApprovedFeedback, getApprovedFeedbackCacheKey } from '../../services/feedbackService';
import useHydratedSnapshot from '../../hooks/useHydratedSnapshot';
import { useLanguage } from '../../i18n/useLanguage';

const Feedback = () => {
    const { t } = useLanguage()
    const {
        snapshot: cachedFeedback,
        hasSnapshot: hasCachedFeedback,
        isHydrated
    } = useHydratedSnapshot(getApprovedFeedbackCacheKey())
    const [feed, setFeed] = useState([])
    const [loading, setLoading] = useState(true)
    const scrollContainerRef = useRef(null)
    const [currentIndex, setCurrentIndex] = useState(0)
    const [isPaused, setIsPaused] = useState(false)
    const [reduceMotion, setReduceMotion] = useState(false)

    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return undefined
        }
        const query = window.matchMedia('(prefers-reduced-motion: reduce)')
        const sync = () => setReduceMotion(query.matches)
        sync()
        query.addEventListener('change', sync)
        return () => query.removeEventListener('change', sync)
    }, [])
    const isMounted = useRef(true)
    const requestIdRef = useRef(0)

    useEffect(() => {
        isMounted.current = true

        return () => {
            isMounted.current = false
        }
    }, [])

    useEffect(() => {
        if (!isHydrated) {
            return
        }

        if (hasCachedFeedback) {
            setFeed(Array.isArray(cachedFeedback) ? cachedFeedback : [])
            setLoading(false)
        }
    }, [cachedFeedback, hasCachedFeedback, isHydrated])

    useEffect(() => {
        if (!isHydrated) {
            return
        }

        const requestId = requestIdRef.current + 1
        requestIdRef.current = requestId

        const fetchFeedback = async () => {
            if (!hasCachedFeedback) {
                setLoading(true)
            }

            try {
                const { data, error } = await getApprovedFeedback()
                if (!isMounted.current || requestId !== requestIdRef.current) {
                    return
                }

                // Always set data (even if empty array) to prevent UI issues
                if (data) {
                    setFeed(Array.isArray(data) ? data : [])
                } else if (error) {
                    console.warn('Failed to fetch feedback, showing cached data if available')
                    // Use cached data as fallback
                    if (hasCachedFeedback && Array.isArray(cachedFeedback)) {
                        setFeed(cachedFeedback)
                    } else {
                        setFeed([])
                    }
                } else {
                    setFeed([])
                }
            } catch (err) {
                console.error('Unexpected error fetching feedback:', err)
                // Ensure feed is always an array to prevent crashes
                setFeed([])
            } finally {
                if (isMounted.current && requestId === requestIdRef.current) {
                    setLoading(false)
                }
            }
        }

        fetchFeedback()
    }, [cachedFeedback, hasCachedFeedback, isHydrated])

    // Auto slide functionality
    useEffect(() => {
        if (feed.length < 2 || isPaused || reduceMotion) return undefined

        const autoSlide = setInterval(() => {
            if (scrollContainerRef.current) {
                const container = scrollContainerRef.current
                const cardWidth = container.offsetWidth
                const maxScroll = container.scrollWidth - container.offsetWidth
                const newScrollLeft = container.scrollLeft + cardWidth

                if (newScrollLeft >= maxScroll) {
                    container.scrollTo({ left: 0, behavior: 'smooth' })
                    if (isMounted.current) {
                        setCurrentIndex(0)
                    }
                } else {
                    container.scrollTo({ left: newScrollLeft, behavior: 'smooth' })
                    if (isMounted.current) {
                        setCurrentIndex(prev => (prev + 1) % feed.length)
                    }
                }
            }
        }, 4000) // Auto slide every 4 seconds

        return () => clearInterval(autoSlide)
    }, [feed.length, isPaused, reduceMotion])

    return (
        <section
            className='py-6'
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
            onFocus={() => setIsPaused(true)}
            onBlur={() => setIsPaused(false)}
            aria-roledescription='carousel'
            aria-label={t('home.feedback.title')}
        >
            <div className='mx-auto max-w-2xl px-4 text-center'>
                <p className='ui-eyebrow'>{t('home.feedback.eyebrow')}</p>
                <h2 className='mt-3 text-2xl font-bold leading-tight text-ink md:text-3xl'>{t('home.feedback.title')}</h2>
                <p className='mx-auto mt-3 max-w-lg text-body text-muted'>{t('home.feedback.subtitle')}</p>
            </div>

            <div className='mt-8'>
                {/* Auto-sliding touch-friendly container */}
                <div
                    ref={scrollContainerRef}
                    className='flex gap-6 overflow-x-scroll scroll-smooth snap-x snap-mandatory scrollbar-hide pb-4 touch-pan-x'
                    style={{
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        WebkitOverflowScrolling: 'touch'
                    }}
                >
                    {loading ? (
                        <div className='w-full flex justify-center py-8'>
                            <div className='animate-pulse flex gap-6'>
                                {[1, 2, 3].map((i) => (
                                    <div key={i} className='min-w-[280px] sm:min-w-[300px] md:min-w-[350px] bg-gray-200 h-48 rounded-2xl'></div>
                                ))}
                            </div>
                        </div>
                    ) : feed && feed.length > 0 ? (
                        feed.map((item, index) =>
                            <div
                                key={item.id || index}
                                className='ui-card flex h-[200px] min-w-[280px] snap-start flex-col p-4 sm:min-w-[300px] md:min-w-[350px]'
                            >
                                {/* Name at top */}
                                <div className='flex items-center gap-3 pb-4 mb-4 border-b border-gray-100'>
                                    <div className='flex h-12 w-12 items-center justify-center rounded-full bg-brand-soft' aria-hidden='true'>
                                        <span className='text-xl font-bold text-brand'>{item.name?.charAt(0)?.toUpperCase()}</span>
                                    </div>
                                    <div>
                                        <p className='font-semibold text-ink'>{item.name}</p>
                                        <p className='text-caption text-muted'>{t('home.feedback.customer')}</p>
                                    </div>
                                </div>

                                {/* Feedback at bottom */}
                                <FaQuoteLeft className='mb-3 flex-shrink-0 text-2xl text-brand/25' aria-hidden='true' />
                                <p className='line-clamp-3 flex-1 overflow-hidden text-caption text-muted'>{item.feedback}</p>
                            </div>
                        )
                    ) : (
                        <div className='w-full py-6'>
                            <p className='rounded-[var(--radius-panel)] border border-dashed border-line bg-canvas px-6 py-10 text-center text-body text-muted'>{t('home.feedback.empty')}</p>
                        </div>
                    )}
                </div>

                {/* Auto-slide indicator dots */}
                {feed && feed.length > 1 && (
                    <div className='mt-4 flex justify-center gap-1' role='group' aria-label={t('home.feedback.title')}>
                        {feed.map((_, index) => (
                            <button
                                key={index}
                                type='button'
                                aria-current={currentIndex === index ? 'true' : undefined}
                                onClick={() => {
                                    if (scrollContainerRef.current) {
                                        const container = scrollContainerRef.current
                                        const cardWidth = container.offsetWidth
                                        container.scrollTo({
                                            left: cardWidth * index,
                                            behavior: 'smooth'
                                        })
                                        setCurrentIndex(index)
                                    }
                                }}
                                className='flex h-6 w-6 items-center justify-center rounded-full'
                                aria-label={t('home.feedback.goToSlide', { index: index + 1 })}
                            >
                                <span className={`block h-2 rounded-full transition-all duration-300 ${currentIndex === index ? 'w-6 bg-brand' : 'w-2 bg-slate-300'}`} />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
};

export default Feedback;
