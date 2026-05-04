import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import { getActiveCoverPhotos, getActiveCoverPhotosCacheKey } from '../../services/coverPhotoService';
import useHydratedSnapshot from '../../hooks/useHydratedSnapshot';
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
    const {
        snapshot: cachedSlides,
        hasSnapshot: hasCachedSlides,
        isHydrated
    } = useHydratedSnapshot(getActiveCoverPhotosCacheKey(COVER_PHOTO_LIMIT));
    const [slides, setSlides] = useState([]);
    const [loading, setLoading] = useState(true);

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

        const fetchCoverPhotos = async () => {
            if (!hasCachedSlides) {
                setLoading(true);
            }

            try {
                const { data, error } = await getActiveCoverPhotos(COVER_PHOTO_LIMIT);

                if (!error && data && data.length > 0) {
                    setSlides(mapSlides(data));
                } else {
                    setSlides([]);
                }
            } catch (err) {
                console.error('Error loading cover photos:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchCoverPhotos();
    }, [hasCachedSlides, isHydrated]);

    // Show loading state
    if (loading) {
        return (
            <div className='w-full animate-fade-in-up'>
                <div className="site-card-strong flex h-[220px] w-full items-center justify-center overflow-hidden rounded-[28px] bg-gray-200 sm:h-[260px] md:h-[340px] lg:h-[420px]">
                    <div className="text-gray-500 text-sm md:text-base">Loading cover photos...</div>
                </div>
            </div>
        );
    }

    // Show message if no admin photos exist
    if (slides.length === 0) {
        return (
            <div className='w-full animate-fade-in-up'>
                <div className="site-card-strong relative flex h-[240px] w-full items-end overflow-hidden rounded-[28px] bg-gradient-to-r from-[#1E73B8] to-[#1665a0] px-5 py-6 shadow-lg sm:h-[300px] sm:px-8 sm:py-8 md:h-[380px]">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.24),transparent_30%),linear-gradient(135deg,rgba(30,115,184,0.98),rgba(11,37,64,0.92))]" />
                    <div className="relative max-w-2xl text-white">
                        <h2 className="text-2xl font-bold leading-tight sm:text-3xl md:text-5xl">Welcome to NewTolet.Com</h2>
                        <Link to="/propertylist2" className="site-button-primary mt-5">
                            Browse Properties
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className='w-full animate-fade-in-up'>
            <div className="relative mx-auto w-full">
                <Swiper
                    modules={[Navigation, Pagination, Autoplay]}
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
                    autoplay={{ delay: 5000, disableOnInteraction: false }}
                    loop
                    className="site-card-strong relative h-[260px] w-full overflow-hidden rounded-[28px] shadow-lg group sm:h-[320px] md:h-[420px] xl:h-[500px]"
                >
                    {slides.map((slide, index) => {
                        return (
                        <SwiperSlide key={slide.id}>
                            <div className="relative h-full w-full">
                                <img
                                    src={slide.image}
                                    alt=""
                                    aria-hidden="true"
                                    className="absolute inset-0 h-full w-full object-cover"
                                    loading={index === 0 ? 'eager' : 'lazy'}
                                    fetchPriority={index === 0 ? 'high' : 'auto'}
                                    decoding="async"
                                    draggable={false}
                                    style={{
                                        objectPosition: 'center center',
                                        filter: 'blur(18px)',
                                        transform: 'scale(1.08)'
                                    }}
                                />

                                <img
                                    src={slide.image}
                                    alt="Cover photo"
                                    className="relative z-[1] mx-auto h-full max-h-full w-auto max-w-full object-contain"
                                    loading={index === 0 ? 'eager' : 'lazy'}
                                    fetchPriority={index === 0 ? 'high' : 'auto'}
                                    decoding="async"
                                    draggable={false}
                                    style={{
                                        objectPosition: 'center center',
                                        imageRendering: 'auto'
                                    }}
                                />

                                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/72 via-slate-950/28 to-transparent"></div>
                            </div>
                        </SwiperSlide>
                    )})}
                </Swiper>

                {/* Custom Navigation Buttons - Hidden on Mobile */}
                <div className="swiper-button-prev-custom absolute left-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/88 text-gray-800 shadow-lg transition-all duration-300 hover:scale-105 hover:bg-white after:content-['<'] after:text-lg after:font-bold md:left-4 md:flex md:h-11 md:w-11"></div>
                <div className="swiper-button-next-custom absolute right-3 top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/88 text-gray-800 shadow-lg transition-all duration-300 hover:scale-105 hover:bg-white after:content-['>'] after:text-lg after:font-bold md:right-4 md:flex md:h-11 md:w-11"></div>
            </div>
        </div>
    );
};

export default Cover;
