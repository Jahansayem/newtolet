import React, { useState, useEffect } from 'react';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay, EffectFade } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import 'swiper/css/effect-fade';
import { getActiveCoverPhotos, getActiveCoverPhotosCacheKey } from '../../services/coverPhotoService';
import useHydratedSnapshot from '../../hooks/useHydratedSnapshot';
import { getOptimizedImageUrl, isSupabaseImage } from '../../utils/imageOptimization';
import './Cover.css';

const COVER_PHOTO_LIMIT = 6;

const mapSlides = (photos = []) =>
    photos.map((photo) => ({
        id: photo.id,
        image: photo.image_url,
        title: 'Find Your Dream Home',
        description: 'Discover the perfect property that suits your lifestyle',
        buttonText: 'Browse Properties'
    }));

const buildCoverImageSources = (imageUrl) => {
    if (!imageUrl) {
        return {
            src: '',
            srcSet: undefined,
            sizes: undefined
        };
    }

    if (!isSupabaseImage(imageUrl)) {
        return {
            src: imageUrl,
            srcSet: undefined,
            sizes: undefined
        };
    }

    const widths = [1280, 1920, 2560];

    return {
        src: getOptimizedImageUrl(imageUrl, {
            width: 1920,
            format: 'webp',
            quality: 92,
            resize: 'cover'
        }),
        srcSet: widths
            .map((width) => (
                `${getOptimizedImageUrl(imageUrl, {
                    width,
                    format: 'webp',
                    quality: 92,
                    resize: 'cover'
                })} ${width}w`
            ))
            .join(', '),
        sizes: '(min-width: 1280px) 1250px, 100vw'
    };
};

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
            <div className='w-full   animate-fade-in-up'>
                <div className="w-full h-[180px] sm:h-[220px] md:h-[300px] lg:h-[400px] bg-gray-200 rounded-lg md:rounded-xl flex items-center justify-center">
                    <div className="text-gray-500 text-sm md:text-base">Loading cover photos...</div>
                </div>
            </div>
        );
    }

    // Show message if no admin photos exist
    if (slides.length === 0) {
        return (
            <div className='w-full  animate-fade-in-up'>
                <div className="w-full h-[180px] sm:h-[220px] md:h-[300px] lg:h-[400px] bg-gradient-to-r from-[#1E73B8] to-[#1665a0] rounded-lg md:rounded-xl flex items-center justify-center shadow-lg md:shadow-xl">
                    <div className="text-center text-white px-4">
                        <h2 className="text-xl sm:text-2xl md:text-4xl font-bold mb-1 md:mb-2">Welcome to NewTolet.Com</h2>
                        <p className="text-xs sm:text-sm md:text-lg opacity-90">Find your perfect rental property in Bangladesh</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className='w-full  animate-fade-in-up'>
            <div className="relative w-full">
                <Swiper
                    modules={[Navigation, Pagination, Autoplay, EffectFade]}
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
                    effect="fade"
                    loop
                    className="w-full h-[140px] md:h-[280px] lg:h-[370px] relative group rounded-lg md:rounded-xl overflow-hidden shadow-lg md:shadow-xl"
                >
                    {slides.map((slide, index) => {
                        const imageProps = buildCoverImageSources(slide.image);

                        return (
                        <SwiperSlide key={slide.id}>
                            <div className="relative h-full w-full">
                                {/* Background Image with zoom effect */}
                                <img
                                    src={imageProps.src}
                                    srcSet={imageProps.srcSet}
                                    sizes={imageProps.sizes}
                                    alt={slide.title}
                                    className="h-full w-full object-cover [transform:translateZ(0)] transition-transform duration-[8000ms] ease-out md:group-hover:scale-[1.03]"
                                    loading={index === 0 ? 'eager' : 'lazy'}
                                    fetchPriority={index === 0 ? 'high' : 'auto'}
                                    decoding="async"
                                    draggable={false}
                                    onError={(e) => {
                                        console.error('Failed to load cover photo:', slide.image);
                                    }}
                                    style={{
                                        objectPosition: 'center center'
                                    }}
                                />

                                {/* Gradient Overlay - adjusted for mobile */}
                                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent md:from-black/50 md:via-black/15"></div>
                            </div>
                        </SwiperSlide>
                    )})}
                </Swiper>

                {/* Custom Navigation Buttons - Hidden on Mobile */}
                <div className="swiper-button-prev-custom hidden md:flex absolute left-2 md:left-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 md:w-12 md:h-12 bg-white/80 hover:bg-white text-gray-800 rounded-full shadow-lg cursor-pointer items-center justify-center transition-all duration-300 hover:scale-110 after:content-['←'] after:text-xl after:font-bold"></div>
                <div className="swiper-button-next-custom hidden md:flex absolute right-2 md:right-4 top-1/2 -translate-y-1/2 z-10 w-10 h-10 md:w-12 md:h-12 bg-white/80 hover:bg-white text-gray-800 rounded-full shadow-lg cursor-pointer items-center justify-center transition-all duration-300 hover:scale-110 after:content-['→'] after:text-xl after:font-bold"></div>
            </div>
        </div>
    );
};

export default Cover;
