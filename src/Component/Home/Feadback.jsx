import React, { useEffect, useRef, useState } from 'react';
import { FaQuoteLeft } from 'react-icons/fa';
import { getApprovedFeedback, getApprovedFeedbackCacheKey } from '../../services/feedbackService';
import useHydratedSnapshot from '../../hooks/useHydratedSnapshot';

const Feedback = () => {
    const {
        snapshot: cachedFeedback,
        hasSnapshot: hasCachedFeedback,
        isHydrated
    } = useHydratedSnapshot(getApprovedFeedbackCacheKey())
    const [feed, setFeed] = useState([])
    const [loading, setLoading] = useState(true)
    const scrollContainerRef = useRef(null)
    const [currentIndex, setCurrentIndex] = useState(0)
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

                if (!error && data) {
                    setFeed(data)
                }
            } catch (err) {
                console.error('Error fetching feedback:', err)
            } finally {
                if (isMounted.current && requestId === requestIdRef.current) {
                    setLoading(false)
                }
            }
        }

        fetchFeedback()
    }, [hasCachedFeedback, isHydrated])

    // Auto slide functionality
    useEffect(() => {
        if (feed.length === 0) return

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
    }, [feed.length])

    return (
        <div className='bg-gray-50 '>
            <div className='text-center max-w-[600px] mx-auto py-10 space-y-3  animate-fade-in-up'>
                <h2 className='text-3xl md:text-4xl font-bold text-gray-800'>Customer Feedback</h2>
                <p className='text-gray-600 text-sm sm:text-base mb-3'>Our Users send us bunch of smilies with our services, and we love them</p>
            </div>

            <div className=' animate-fade-in-up animation-delay-200'>
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
                                className='min-w-[280px] sm:min-w-[300px] md:min-w-[350px] h-[200px] snap-start bg-white p-4 rounded-xl shadow-md border border-gray-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-2 group flex flex-col'
                                style={{ animationDelay: `${index * 100}ms` }}
                            >
                                {/* Name at top */}
                                <div className='flex items-center gap-3 pb-4 mb-4 border-b border-gray-100'>
                                    <div className='w-12 h-12 bg-[#1E73B8]/10 rounded-full flex items-center justify-center group-hover:bg-[#1E73B8]/20 transition-colors duration-300'>
                                        <span className='text-[#1E73B8] font-bold text-xl'>{item.name?.charAt(0)?.toUpperCase()}</span>
                                    </div>
                                    <div>
                                        <p className='font-semibold text-gray-800'>{item.name}</p>
                                        <p className='text-xs text-gray-400'>Customer</p>
                                    </div>
                                </div>

                                {/* Feedback at bottom */}
                                <FaQuoteLeft className='text-[#1E73B8]/20 text-2xl mb-3 group-hover:text-[#1E73B8]/40 transition-colors duration-300 flex-shrink-0' />
                                <p className='text-gray-600 text-sm leading-relaxed line-clamp-3 flex-1 overflow-hidden'>{item.feedback}</p>
                            </div>
                        )
                    ) : (
                        <div className='w-full flex justify-center py-8'>
                            <p className='text-gray-500'>No feedback yet. Be the first to share your experience!</p>
                        </div>
                    )}
                </div>

                {/* Auto-slide indicator dots */}
                {feed && feed.length > 1 && (
                    <div className='flex justify-center gap-2 mt-4'>
                        {feed.map((_, index) => (
                            <button
                                key={index}
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
                                className={`w-2 h-2 rounded-full transition-all duration-300 ${currentIndex === index ? 'bg-[#1E73B8] w-6' : 'bg-gray-300'}`}
                                aria-label={`Go to slide ${index + 1}`}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Feedback;
