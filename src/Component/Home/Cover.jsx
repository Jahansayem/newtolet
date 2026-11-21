import React, { useState, useEffect, useRef } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import { FiChevronLeft, FiChevronRight, FiPause, FiPlay } from 'react-icons/fi';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { getActiveCoverPhotos, getActiveCoverPhotosCacheKey } from '../../services/coverPhotoService';
import useHydratedSnapshot from '../../hooks/useHydratedSnapshot';
import { useLanguage } from '../../i18n/useLanguage';
import { COVER_FRAME_CLASSES } from './coverFrame';
import './Cover.css';

const COVER_PHOTO_LIMIT = 6;

const mapSlides = (photos = []) =>
    photos
        .filter((photo) => typeof photo?.image_url === 'string' && photo.image_url.trim() !== '')
        .map((photo) => ({
            id: photo.id,
            image: photo.image_url.trim(),
        }));

const Cover = () => {
    const { t } = useLanguage();
    const {
        snapshot: cachedSlides,
        hasSnapshot: hasCachedSlides,
        isHydrated
    } = useHydratedSnapshot(getActiveCoverPhotosCacheKey(COVER_PHOTO_LIMIT));
    const [slides, setSlides] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reduceMotion, setReduceMotion] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const swiperRef = useRef(null);

    // Respect the OS "reduce motion" preference: no autoplay, no slide animation.
    useEffect(() => {
        if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
            return undefined;
        }

        const query = window.matchMedia('(prefers-reduced-motion: reduce)');
        const sync = () => setReduceMotion(query.matches);
        sync();
        query.addEventListener('change', sync);

        return () => query.removeEventListener('change', sync);
    }, []);
    const isMounted = useRef(true);
    const requestIdRef = useRef(0);

    useEffect(() => {
        isMounted.current = true;

        return () => {
            isMounted.current = false;
        };
    }, []);

    useEffect(() => {
        if (!isHydrated) {
            return;
        }

        if (hasCachedSlides) {
            setSlides(mapSlides(Array.isArray(cachedSlides) ? cachedSlides : []));
            setLoading(false);
        }
    }, [cachedSlides, hasCachedSlides, isHydrated]);

    useEffect(() => {
        if (!isHydrated) {
            return;
        }

        const requestId = requestIdRef.current + 1;
        requestIdRef.current = requestId;

        const fetchCoverPhotos = async () => {
            if (!hasCachedSlides) {
                setLoading(true);
            }

            try {
                const { data, error } = await getActiveCoverPhotos(COVER_PHOTO_LIMIT);

                if (!isMounted.current || requestId !== requestIdRef.current) {
                    return;
                }

                if (!error && data && data.length > 0) {
                    setSlides(mapSlides(data));
                } else {
                    setSlides([]);
                }
            } catch (err) {
                console.error('Error loading cover photos:', err);
            } finally {
                if (isMounted.current && requestId === requestIdRef.current) {
                    setLoading(false);
                }
            }
        };

        fetchCoverPhotos();
    }, [hasCachedSlides, isHydrated]);

    const togglePlayback = () => {
        const swiper = swiperRef.current;
        if (!swiper?.autoplay) {
            return;
        }

        if (isPaused) {
            swiper.autoplay.start();
        } else {
            swiper.autoplay.stop();
        }
        setIsPaused((current) => !current);
    };

    if (loading) {
        return (
            <div
                role='status'
                aria-label={t('home.cover.loading')}
                className={`${COVER_FRAME_CLASSES} mx-auto animate-pulse rounded-2xl bg-slate-200`}
            />
        );
    }

    // No admin cover photos: the hero already carries the message, so nothing else is rendered.
    if (slides.length === 0) {
        return null;
    }

    const autoplayEnabled = !reduceMotion && slides.length > 1;

    return (
        <div className='relative mx-auto w-full'>
            <Swiper
                modules={[Navigation, Pagination, Autoplay]}
                onSwiper={(instance) => {
                    swiperRef.current = instance;
                }}
                navigation={{
                    nextEl: '.swiper-button-next-custom',
                    prevEl: '.swiper-button-prev-custom',
                    hiddenClass: 'hidden'
                }}
                pagination={{
                    clickable: true,
                    dynamicBullets: true,
                    dynamicMainBullets: 3
                }}
                autoplay={autoplayEnabled ? { delay: 5000, disableOnInteraction: false, pauseOnMouseEnter: true } : false}
                speed={reduceMotion ? 0 : 300}
                loop={slides.length > 1}
                className={`cover-swiper relative ${COVER_FRAME_CLASSES} overflow-hidden rounded-2xl border border-line bg-slate-100 shadow-card group`}
            >
                {slides.map((slide, index) => (
                    <SwiperSlide key={slide.id}>
                        <div className='relative h-full w-full bg-slate-100'>
                            <img
                                src={slide.image}
                                alt={`${t('home.cover.photoAlt')} ${index + 1}`}
                                className='relative z-[1] h-full w-full object-cover'
                                loading='eager'
                                fetchPriority={index === 0 ? 'high' : 'auto'}
                                decoding='async'
                                draggable={false}
                            />
                        </div>
                    </SwiperSlide>
                ))}
            </Swiper>

            {slides.length > 1 ? (
                <>
                    <button
                        type='button'
                        aria-label={t('home.cover.previousSlide')}
                        className='swiper-button-prev-custom ui-btn ui-btn-icon absolute left-3 top-1/2 z-10 hidden -translate-y-1/2 bg-white/90 text-ink shadow-raised hover:bg-white md:inline-flex'
                    >
                        <FiChevronLeft className='text-xl' aria-hidden='true' />
                    </button>
                    <button
                        type='button'
                        aria-label={t('home.cover.nextSlide')}
                        className='swiper-button-next-custom ui-btn ui-btn-icon absolute right-3 top-1/2 z-10 hidden -translate-y-1/2 bg-white/90 text-ink shadow-raised hover:bg-white md:inline-flex'
                    >
                        <FiChevronRight className='text-xl' aria-hidden='true' />
                    </button>
                    {autoplayEnabled ? (
                        <button
                            type='button'
                            onClick={togglePlayback}
                            aria-pressed={isPaused}
                            aria-label={isPaused ? t('home.cover.play') : t('home.cover.pause')}
                            className='ui-btn ui-btn-icon absolute bottom-3 right-3 z-10 bg-ink/70 text-white hover:bg-ink'
                        >
                            {isPaused ? <FiPlay className='text-base' aria-hidden='true' /> : <FiPause className='text-base' aria-hidden='true' />}
                        </button>
                    ) : null}
                </>
            ) : null}
        </div>
    );
};

export default Cover;
