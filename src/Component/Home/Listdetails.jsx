import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
    FiMapPin,
    FiPhone,
    FiHome,
    FiUsers,
    FiLayers,
    FiMaximize2,
    FiArrowLeft,
    FiHeart,
    FiShare2,
    FiChevronLeft,
    FiChevronRight,
    FiLock,
    FiUser
} from 'react-icons/fi';
import useHydratedSnapshot from '../../hooks/useHydratedSnapshot';
import { useAuth } from '../../hooks/useAuth';
import {
    getPropertyById,
    getPropertyByIdCacheKey
} from '../../services/propertyService';
import {
    getContactViewCost,
    getUserCredits,
    unlockContactAccess
} from '../../services/creditService';
import {
    getSavedPropertyIds,
    recordPropertyView,
    toggleSavedProperty,
    SAVED_PROPERTIES_BROWSER_EVENT,
} from '../../services/userPanelService';
import RentDisplay from '../../components/RentDisplay';
import { isRentNegotiable } from '../../utils/rentDisplay';

const Listdetails = () => {
    const [searchParams] = useSearchParams();
    const id = searchParams.get('id') || '';
    const { user, session, isLoading: isAuthLoading, updateUserInContext } = useAuth();
    const viewer = useMemo(() => ({
        viewerId: user?.id || null,
        canViewProtected: user?.is_admin === true
    }), [user?.id, user?.is_admin]);
    const propertyCacheKey = getPropertyByIdCacheKey(id, viewer);
    const {
        snapshot: cachedProperty,
        hasSnapshot: hasCachedProperty,
        isHydrated
    } = useHydratedSnapshot(propertyCacheKey);
    const [lists, setLists] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isFavorite, setIsFavorite] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [showUnlockModal, setShowUnlockModal] = useState(false);
    const [unlockCost, setUnlockCost] = useState(20);
    const [currentCredits, setCurrentCredits] = useState(0);
    const [unlockError, setUnlockError] = useState('');
    const [isUnlocking, setIsUnlocking] = useState(false);

    useEffect(() => {
        if (!isHydrated) {
            return;
        }

        if (hasCachedProperty) {
            setLists(cachedProperty);
            setLoading(false);
        }
    }, [cachedProperty, hasCachedProperty, isHydrated]);

    useEffect(() => {
        let isMounted = true;

        const loadUnlockCost = async () => {
            try {
                const cost = await getContactViewCost();
                if (isMounted) {
                    setUnlockCost(Number(cost) || 20);
                }
            } catch (error) {
                console.error('Error loading contact unlock cost:', error);
            }
        };

        loadUnlockCost();

        return () => {
            isMounted = false;
        };
    }, []);

    useEffect(() => {
        if (!user?.id) {
            setCurrentCredits(0);
            return;
        }

        let isMounted = true;

        const loadCurrentCredits = async () => {
            try {
                const credits = await getUserCredits(user.id);
                if (isMounted) {
                    setCurrentCredits(credits);
                }
            } catch (error) {
                console.error('Error loading current points:', error);
            }
        };

        loadCurrentCredits();

        return () => {
            isMounted = false;
        };
    }, [user?.id]);

    useEffect(() => {
        if (!isHydrated || isAuthLoading) {
            return;
        }

        let isMounted = true;

        const loadProperty = async () => {
            if (!id) {
                setLists(null);
                setLoadError('Property ID is missing.');
                setLoading(false);
                return;
            }

            if (!hasCachedProperty) {
                setLoading(true);
            }

            setLoadError(null);

            try {
                const property = await getPropertyById(id, viewer);
                if (isMounted) {
                    setLists(property);
                }
            } catch (error) {
                console.error('Error loading property details:', error);
                if (isMounted && !hasCachedProperty) {
                    setLists(null);
                    setLoadError('Property not found.');
                }
            } finally {
                if (isMounted) {
                    setLoading(false);
                }
            }
        };

        loadProperty();
        window.scrollTo(0, 0);

        return () => {
            isMounted = false;
        };
    }, [
        hasCachedProperty,
        id,
        isAuthLoading,
        isHydrated,
        viewer
    ]);

    useEffect(() => {
        const syncSavedState = async () => {
            const savedIds = await getSavedPropertyIds(user?.id || null);
            setIsFavorite(savedIds.includes(id));
        };

        if (!id) {
            return;
        }

        void syncSavedState();
        window.addEventListener(SAVED_PROPERTIES_BROWSER_EVENT, syncSavedState);
        window.addEventListener('userLogin', syncSavedState);
        window.addEventListener('userLogout', syncSavedState);

        return () => {
            window.removeEventListener(SAVED_PROPERTIES_BROWSER_EVENT, syncSavedState);
            window.removeEventListener('userLogin', syncSavedState);
            window.removeEventListener('userLogout', syncSavedState);
        };
    }, [id, user?.id]);

    useEffect(() => {
        if (!session?.user?.id || session.user.id !== user?.id || !id) {
            return;
        }

        void recordPropertyView(user.id, id);
    }, [id, session?.user?.id, user?.id]);

    const syncStoredCredits = (nextCredits) => {
        if (typeof window === 'undefined') {
            return;
        }

        try {
            const storedUser = localStorage.getItem('user');
            if (!storedUser) {
                return;
            }

            const parsedUser = JSON.parse(storedUser);
            localStorage.setItem('user', JSON.stringify({
                ...parsedUser,
                credits: nextCredits
            }));
        } catch (error) {
            console.error('Error syncing stored credits:', error);
        }
    };

    const refreshUnlockedProperty = async () => {
        const property = await getPropertyById(id, viewer);
        setLists(property);
    };

    const handleUnlockProtectedInfo = async () => {
        if (!user?.id) {
            setUnlockError('Please login to unlock contact information.');
            return;
        }

        setIsUnlocking(true);
        setUnlockError('');

        try {
            const result = await unlockContactAccess(user.id, id);
            setCurrentCredits(result.remainingCredits);
            syncStoredCredits(result.remainingCredits);
            updateUserInContext({ credits: result.remainingCredits });
            await refreshUnlockedProperty();
            setShowUnlockModal(false);
        } catch (error) {
            console.error('Error unlocking property contact:', error);
            const normalizedMessage = error.message || '';
            if (normalizedMessage.toLowerCase().includes('insufficient credits') || normalizedMessage.toLowerCase().includes('enough points')) {
                setUnlockError('You do not have enough points. Buy points to unlock this property.');
            } else if (normalizedMessage.toLowerCase().includes('schema cache') || normalizedMessage.toLowerCase().includes('could not find the function')) {
                setUnlockError('Unlock is temporarily unavailable. Please try again shortly.');
            } else {
                setUnlockError(normalizedMessage || 'Failed to unlock contact information.');
            }
        } finally {
            setIsUnlocking(false);
        }
    };

    const handleToggleFavorite = async () => {
        try {
            const result = await toggleSavedProperty(user?.id || null, id);
            setIsFavorite(Boolean(result?.saved));
        } catch (error) {
            console.error('Error toggling favorite property:', error);
        }
    };

    if (loading || isAuthLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-[#1E73B8] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-600">Loading property details...</p>
                </div>
            </div>
        );
    }

    if (!lists || loadError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
                <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md">
                    <p className="text-xl font-semibold text-gray-900">Property not found</p>
                    <p className="text-gray-600 mt-2">{loadError || 'The requested property is unavailable.'}</p>
                    <Link to="/" className="inline-block mt-6 bg-[#1E73B8] text-white px-6 py-3 rounded-xl font-semibold">
                        Browse Properties
                    </Link>
                </div>
            </div>
        );
    }

    const location = lists.location || {};
    const pricing = lists.pricing || {};
    const isNegotiableRent = isRentNegotiable(pricing);
    const specifications = lists.specifications || {};
    const amenities = lists.amenities || [];
    const images = lists.images?.length
        ? lists.images
        : [lists.image_url || 'https://via.placeholder.com/800x600'];
    const isProtectedUnlocked = Boolean(lists.protected_contact_unlocked);
    const hasEnoughPoints = currentCredits >= unlockCost;
    const publicLocationText = [location.sub_area, location.area, location.state_district].filter(Boolean).join(', ');
    const protectedLocationText = [location.house_plot, location.road, location.sector].filter(Boolean).join(', ');
    const visibleLocationText = publicLocationText || location.state_district || 'Bangladesh';
    const imageLocationLabel = location.area || location.state_district || 'Bangladesh';

    const handlePrevImage = () => {
        setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    };

    const handleNextImage = () => {
        setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    };

    const renderLoginPromptPanel = () => (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                    <p className="text-lg font-bold text-gray-900">Please login for show the contact information.</p>
                    <p className="mt-2 text-sm text-gray-600">
                        Please log in or register to view the full property details. We protect the privacy of owners and do not
                        share contact information with unregistered users.
                    </p>
                    <p className="mt-1 text-xs font-medium text-red-500">(Terms &amp; conditions apply)</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <Link
                        to="/login"
                        className="inline-flex items-center justify-center rounded-xl bg-[#1E73B8] px-4 py-2 font-semibold text-white transition hover:bg-[#1665a0]"
                    >
                        <FiUser className="mr-2" />
                        Login
                    </Link>
                    <Link
                        to="/registration"
                        className="inline-flex items-center justify-center rounded-xl border border-[#1E73B8] px-4 py-2 font-semibold text-[#1E73B8] transition hover:bg-[#1E73B8] hover:text-white"
                    >
                        Register
                    </Link>
                </div>
            </div>
        </div>
    );

    const renderLockedUnlockPanel = () => (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <FiLock className="text-red-500" size={18} />
                        <p className="text-lg font-bold text-gray-900">Unlock Contact Details</p>
                    </div>
                    <p className="mt-2 text-sm text-red-500">
                        Press the unlock button to get the specific address and publisher/owner contact information of this property.
                    </p>
                    <p className="mt-3 text-sm text-gray-500">
                        Available points: <span className="font-semibold text-gray-900">{currentCredits}</span>
                    </p>
                    {unlockError && (
                        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                            {unlockError}
                        </p>
                    )}
                </div>
                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={() => {
                            setUnlockError('');
                            setShowUnlockModal(true);
                        }}
                        disabled={isUnlocking}
                        className="inline-flex items-center justify-center rounded-xl bg-red-500 px-5 py-3 font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                        <FiLock className="mr-2" />
                        {isUnlocking ? 'Unlocking...' : 'Unlock'}
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            <div className="bg-white shadow-sm">
                <div className="site-shell py-3">
                    <nav className="flex items-center gap-2 text-sm flex-wrap">
                        <Link to="/" className="text-[#1E73B8] hover:text-[#1665a0] transition">
                            Home
                        </Link>
                        <span className="text-gray-400">&gt;</span>
                        <span className="text-[#1E73B8]">
                            {location.state_district || 'Dhaka'}
                        </span>
                        {Boolean(location.area || location.sub_area) && (
                            <>
                                <span className="text-gray-400">&gt;</span>
                                <span className="text-[#1E73B8]">
                                    {[location.sub_area, location.area].filter(Boolean).join(', ')}
                                </span>
                            </>
                        )}
                        <span className="text-gray-400">&gt;</span>
                        <span className="text-[#1E73B8] font-medium">
                            {lists.category || 'Category'}
                        </span>
                    </nav>
                </div>
            </div>

            <div className="sticky top-[72px] z-40 border-b border-slate-200/80 bg-white/95 shadow-sm backdrop-blur md:top-[118px]">
                <div className="site-shell-wide flex flex-wrap items-center justify-between gap-3 py-4">
                    <Link to="/" className="flex min-w-0 items-center gap-2 text-[#1E73B8] transition hover:text-[#1665a0]">
                        <FiArrowLeft size={24} />
                        <span className="truncate font-medium">Back to Home</span>
                    </Link>
                    <div className="flex items-center gap-2 sm:gap-3">
                        <button
                            onClick={handleToggleFavorite}
                            className={`rounded-full p-2.5 transition ${isFavorite ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            <FiHeart size={22} fill={isFavorite ? 'currentColor' : 'none'} />
                        </button>
                        <button className="rounded-full bg-gray-100 p-2.5 text-gray-600 transition hover:bg-gray-200">
                            <FiShare2 size={22} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="site-shell-wide py-6">
                <div className="site-card-strong mb-6 overflow-hidden">
                    <div className="relative">
                        <div className="aspect-[4/3] bg-gray-200 sm:aspect-video md:aspect-[21/9]">
                            <img
                                src={images[currentImageIndex] || images[0]}
                                alt={`${lists.property_type} in ${imageLocationLabel}`}
                                className="w-full h-full object-cover"
                            />
                        </div>

                        {images.length > 1 && (
                            <>
                                <button
                                    onClick={handlePrevImage}
                                    className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg transition hover:bg-white sm:left-4"
                                >
                                    <FiChevronLeft size={20} />
                                </button>
                                <button
                                    onClick={handleNextImage}
                                    className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 shadow-lg transition hover:bg-white sm:right-4"
                                >
                                    <FiChevronRight size={20} />
                                </button>

                                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                                    {images.map((_, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setCurrentImageIndex(idx)}
                                            className={`w-2 h-2 rounded-full transition ${currentImageIndex === idx ? 'bg-white w-6' : 'bg-white/50'}`}
                                        />
                                    ))}
                                </div>

                                <div className="absolute right-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm text-white sm:right-4 sm:top-4">
                                    {currentImageIndex + 1} / {images.length}
                                </div>
                            </>
                        )}
                    </div>

                    {images.length > 1 && (
                        <div className="flex gap-3 overflow-x-auto p-4">
                            {images.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentImageIndex(idx)}
                                    className={`h-16 w-20 flex-shrink-0 overflow-hidden rounded-xl border-2 transition sm:h-20 sm:w-28 ${currentImageIndex === idx ? 'border-[#1E73B8]' : 'border-transparent'}`}
                                >
                                    <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.9fr)]">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="site-card p-5 sm:p-6">
                            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                    <div className='mb-2 flex items-center gap-3'>
                                        {lists.property_id_number && (
                                            <p className='rounded-full bg-[#1E73B8]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#1E73B8] sm:text-sm'>
                                                Property ID: #{lists.property_id_number}
                                            </p>
                                        )}
                                    </div>
                                    <h1 className="text-2xl font-bold leading-tight text-gray-900 md:text-3xl">
                                        {lists.property_type || 'Property'}
                                    </h1>
                                    <div className="mt-2 flex items-start gap-2 text-gray-600">
                                        <FiMapPin className="text-[#1E73B8]" />
                                        <span className="leading-6">{visibleLocationText}</span>
                                    </div>
                                </div>
                                <div className="rounded-2xl bg-slate-50 px-4 py-3 sm:min-w-[220px] sm:text-right">
                                    <p className="text-3xl font-bold text-[#1E73B8] md:text-4xl">
                                        <RentDisplay pricing={pricing} />
                                    </p>
                                    {!isNegotiableRent && (
                                        <p className="text-gray-500">/ {pricing.rent_period || 'month'}</p>
                                    )}
                                </div>
                            </div>

                            <div className="mt-6 grid grid-cols-2 gap-3 border-t pt-6 sm:grid-cols-2 lg:grid-cols-4">
                                <div className="rounded-2xl bg-blue-50 p-3 text-center">
                                    <FiHome className="mx-auto text-[#1E73B8] mb-1" size={24} />
                                    <p className="text-sm text-gray-600">Category</p>
                                    <p className="font-semibold">{lists.category || 'N/A'}</p>
                                </div>
                                <div className="rounded-2xl bg-blue-50 p-3 text-center">
                                    <FiLayers className="mx-auto text-[#1E73B8] mb-1" size={24} />
                                    <p className="text-sm text-gray-600">Type</p>
                                    <p className="font-semibold">{lists.property_type || 'N/A'}</p>
                                </div>
                                <div className="rounded-2xl bg-blue-50 p-3 text-center">
                                    <FiUsers className="mx-auto text-[#1E73B8] mb-1" size={24} />
                                    <p className="text-sm text-gray-600">Floor</p>
                                    <p className="font-semibold">{specifications.floor_level || lists.floor_level || 'N/A'}</p>
                                </div>
                                <div className="rounded-2xl bg-blue-50 p-3 text-center">
                                    <FiMaximize2 className="mx-auto text-[#1E73B8] mb-1" size={24} />
                                    <p className="text-sm text-gray-600">Bathrooms</p>
                                    <p className="font-semibold">{specifications.total_bathrooms || lists.total_bathrooms || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div className="rounded-2xl bg-green-50 p-3 text-center">
                                    <p className="text-sm text-gray-600">Dining</p>
                                    <p className="font-semibold text-green-700">
                                        {lists.dining_rooms ?? specifications.dining_rooms ?? 0}
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-yellow-50 p-3 text-center">
                                    <p className="text-sm text-gray-600">Drawing Room</p>
                                    <p className="font-semibold text-yellow-700">
                                        {Number(lists.living_rooms ?? specifications.living_rooms ?? 0) > 0 ? 'Yes' : 'No'}
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-purple-50 p-3 text-center">
                                    <p className="text-sm text-gray-600">Balcony</p>
                                    <p className="font-semibold text-purple-700">
                                        {lists.balcony ?? specifications.total_balcony ?? specifications.balcony ?? 0}
                                    </p>
                                </div>
                                <div className="rounded-2xl bg-orange-50 p-3 text-center">
                                    <p className="text-sm text-gray-600">Kitchen</p>
                                    <p className="font-semibold text-orange-700">
                                        {lists.kitchen ?? lists.total_kitchen ?? specifications.total_kitchen ?? specifications.kitchen ?? 0}
                                    </p>
                                </div>
                            </div>

                            {lists.occupancy && (
                                <div className="mt-4 p-4 bg-red-50 rounded-xl border border-red-200">
                                    <p className="text-sm text-red-600 font-semibold">Occupancy Restrictions</p>
                                    <p className="text-gray-700 mt-1">{lists.occupancy}</p>
                                </div>
                            )}
                        </div>

                        <div className="site-card p-5 sm:p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Description</h2>
                            <p className="text-gray-600 leading-relaxed">
                                {location.short_description || location.description || 'No description available for this property.'}
                            </p>
                        </div>

                        <div className="site-card p-5 sm:p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Facilities</h2>
                            {amenities.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-3">
                                    {amenities.map((amenity, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-gray-700">
                                            <div className="w-2 h-2 bg-[#1E73B8] rounded-full"></div>
                                            <span>{amenity}</span>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500 italic">No facilities listed for this property.</p>
                            )}
                        </div>
                    </div>

                    <div className="lg:col-span-1">
                        <div className="site-card p-5 sm:p-6 xl:sticky xl:top-[calc(118px+1rem)]">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Contact Information</h3>

                            <div className="space-y-4">
                                <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-3">
                                    <div className="w-10 h-10 bg-[#1E73B8] rounded-full flex items-center justify-center">
                                        <FiPhone className="text-white" size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs text-gray-500">Contact Number</p>
                                        <p className="break-words font-semibold text-gray-900">
                                            {isProtectedUnlocked ? (location.contact_number || 'N/A') : 'Unlock to view contact number'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-3">
                                    <div className="w-10 h-10 bg-[#1E73B8] rounded-full flex items-center justify-center">
                                        <FiMapPin className="text-white" size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs text-gray-500">Short Address</p>
                                        <p className="break-words font-semibold text-gray-900">
                                            {isProtectedUnlocked ? (protectedLocationText || 'Short address not available') : 'Unlock to view short address'}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {isProtectedUnlocked ? (
                                <div className="mt-6 space-y-3">
                                    <button
                                        onClick={() => setShowContactModal(true)}
                                        className="w-full bg-[#1E73B8] hover:bg-[#1665a0] text-white py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
                                    >
                                        <FiPhone size={20} />
                                        Contact Owner
                                    </button>
                                    <a
                                        href={location.contact_number ? `tel:${location.contact_number}` : undefined}
                                        className="block w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl font-semibold transition flex items-center justify-center gap-2"
                                    >
                                        <FiPhone size={20} />
                                        Call Now
                                    </a>
                                </div>
                            ) : !user?.id ? (
                                renderLoginPromptPanel()
                            ) : (
                                renderLockedUnlockPanel()
                            )}

                            <div className="mt-6 p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                                <h4 className="font-semibold text-yellow-800 mb-2">Safety Tips</h4>
                                <ul className="text-xs text-yellow-700 space-y-1">
                                    <li>- Meet in a safe, public location</li>
                                    <li>- Verify the property before payment</li>
                                    <li>- Do not pay in advance</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showContactModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowContactModal(false)}>
                    <div className="max-h-[calc(100vh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold">Contact Owner</h3>
                            <button onClick={() => setShowContactModal(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                <FiChevronLeft size={24} />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div className="p-4 bg-blue-50 rounded-xl">
                                <p className="text-sm text-gray-600 mb-1">Property</p>
                                <p className="font-semibold">{lists.property_type}</p>
                                <p className="text-sm text-gray-600 mt-2">District</p>
                                <p className="font-semibold">{location.state_district || 'N/A'}</p>
                                <p className="text-sm text-gray-600 mt-2">Short Address</p>
                                <p className="font-semibold">
                                    {isProtectedUnlocked ? (protectedLocationText || 'Short address not available') : 'Unlock to view short address'}
                                </p>
                            </div>

                            {isProtectedUnlocked ? (
                                <a
                                    href={location.contact_number ? `tel:${location.contact_number}` : undefined}
                                    className="block w-full bg-[#1E73B8] hover:bg-[#1665a0] text-white py-3 rounded-xl font-semibold text-center transition"
                                >
                                    <FiPhone className="inline mr-2" />
                                    {location.contact_number || 'Contact Number Not Available'}
                                </a>
                            ) : !user?.id ? (
                                renderLoginPromptPanel()
                            ) : (
                                renderLockedUnlockPanel()
                            )}
                        </div>
                    </div>
                </div>
            )}

            {showUnlockModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => {
                        if (!isUnlocking) {
                            setShowUnlockModal(false);
                        }
                    }}
                >
                    <div
                        className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Are you sure?</h3>
                                <p className="mt-2 text-sm text-gray-600">
                                    Viewing all locked information requires <span className="font-semibold text-[#1E73B8]">{unlockCost} points</span>.
                                    After unlocking, you will gain access to the exact address and publisher/owner details of this property.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowUnlockModal(false)}
                                disabled={isUnlocking}
                                className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100"
                            >
                                <FiChevronLeft size={20} />
                            </button>
                        </div>

                        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <p className="text-sm font-semibold text-gray-900">{lists.property_type || lists.category}</p>
                            <p className="mt-2 text-sm text-gray-600">
                                District: <span className="font-medium text-gray-900">{location.state_district || 'N/A'}</span>
                            </p>
                            <p className="mt-1 text-sm text-gray-600">
                                Points available: <span className="font-medium text-gray-900">{currentCredits}</span>
                            </p>
                        </div>

                        <div className="mt-4 rounded-2xl border border-[#1E73B8]/15 bg-[#1E73B8]/5 p-4">
                            <p className="text-sm font-semibold text-gray-900">Refund claim option</p>
                            <p className="mt-1 text-sm text-gray-600">
                                If the property is no longer available and qualifies under policy, you can submit a review-based refund claim within 72 hours of unlocking.
                            </p>
                            <Link to="/refund" className="mt-3 inline-flex text-sm font-semibold text-[#1E73B8] hover:underline">
                                Read Refund Policy
                            </Link>
                        </div>

                        {!hasEnoughPoints && (
                            <div className="mt-4 rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-700">
                                You do not have enough points to unlock this property. Buy more points to continue.
                            </div>
                        )}

                        {unlockError && (
                            <p className="mt-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                                {unlockError}
                            </p>
                        )}

                        <div className="mt-6 flex flex-wrap justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setShowUnlockModal(false)}
                                disabled={isUnlocking}
                                className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 transition hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleUnlockProtectedInfo}
                                disabled={isUnlocking || !hasEnoughPoints}
                                className="rounded-xl bg-red-500 px-4 py-2 font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {isUnlocking ? 'Unlocking...' : 'Yes, confirm'}
                            </button>
                            {!hasEnoughPoints && (
                                <Link
                                    to="/book/buy-credits"
                                    className="rounded-xl bg-[#1E73B8] px-4 py-2 font-semibold text-white transition hover:bg-[#1665a0]"
                                >
                                    Buy Points
                                </Link>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Listdetails;
