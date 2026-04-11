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
    FiLock
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

const Listdetails = () => {
    const [searchParams] = useSearchParams();
    const id = searchParams.get('id') || '';
    const { user, isLoading: isAuthLoading, updateUserInContext } = useAuth();
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
    const [unlockCost, setUnlockCost] = useState(10);
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
                    setUnlockCost(Number(cost) || 10);
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
                console.error('Error loading current credits:', error);
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
        if (!user?.id || !id) {
            return;
        }

        void recordPropertyView(user.id, id);
    }, [id, user?.id]);

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
        } catch (error) {
            console.error('Error unlocking property contact:', error);
            if (error.message?.toLowerCase().includes('insufficient credits')) {
                setUnlockError('You do not have enough credits. Buy credits to unlock this property.');
            } else {
                setUnlockError(error.message || 'Failed to unlock contact information.');
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
    const specifications = lists.specifications || {};
    const amenities = lists.amenities || [];
    const images = lists.images?.length
        ? lists.images
        : [lists.image_url || 'https://via.placeholder.com/800x600'];
    const isProtectedUnlocked = Boolean(lists.protected_contact_unlocked);
    const shortAddress = [location.sub_area, location.area].filter(Boolean).join(', ');
    const protectedLocationText = shortAddress || 'Short address not available';
    const visibleLocationText = isProtectedUnlocked
        ? [location.sub_area, location.area, location.state_district].filter(Boolean).join(', ')
        : (location.state_district || 'Bangladesh');
    const imageLocationLabel = isProtectedUnlocked
        ? (location.area || location.state_district || 'Bangladesh')
        : (location.state_district || 'Bangladesh');

    const handlePrevImage = () => {
        setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    };

    const handleNextImage = () => {
        setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    };

    const renderUnlockPanel = () => (
        <div className="mt-4 rounded-2xl border border-[#1E73B8]/15 bg-gradient-to-br from-[#1E73B8]/5 to-white p-4">
            <div className="flex items-start gap-3">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-[#1E73B8] text-white">
                    <FiLock size={18} />
                </div>
                <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">Unlock contact and short address</p>
                    <p className="mt-1 text-sm text-gray-600">
                        Spend <span className="font-semibold text-[#1E73B8]">{unlockCost} credits</span> to view the owner's phone number and short address for this property.
                    </p>
                    {user?.id ? (
                        <p className="mt-2 text-sm text-gray-500">
                            Available credits: <span className="font-semibold text-gray-900">{currentCredits}</span>
                        </p>
                    ) : (
                        <p className="mt-2 text-sm text-gray-500">Login is required before credits can be used.</p>
                    )}
                    {unlockError && (
                        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
                            {unlockError}
                        </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-3">
                        {!user?.id ? (
                            <Link
                                to="/login"
                                className="inline-flex items-center justify-center rounded-xl bg-[#1E73B8] px-4 py-2 font-semibold text-white transition hover:bg-[#1665a0]"
                            >
                                Login to Unlock
                            </Link>
                        ) : currentCredits < unlockCost ? (
                            <Link
                                to="/book"
                                className="inline-flex items-center justify-center rounded-xl bg-[#1E73B8] px-4 py-2 font-semibold text-white transition hover:bg-[#1665a0]"
                            >
                                Buy Credits
                            </Link>
                        ) : (
                            <button
                                onClick={handleUnlockProtectedInfo}
                                disabled={isUnlocking}
                                className="inline-flex items-center justify-center rounded-xl bg-[#1E73B8] px-4 py-2 font-semibold text-white transition hover:bg-[#1665a0] disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {isUnlocking ? 'Unlocking...' : `Unlock for ${unlockCost} Credits`}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 pb-10">
            <div className="bg-white shadow-sm">
                <div className="max-w-7xl mx-auto px-4 py-3">
                    <nav className="flex items-center gap-2 text-sm flex-wrap">
                        <Link to="/" className="text-[#1E73B8] hover:text-[#1665a0] transition">
                            Home
                        </Link>
                        <span className="text-gray-400">&gt;</span>
                        <span className="text-[#1E73B8]">
                            {location.state_district || 'Dhaka'}
                        </span>
                        {isProtectedUnlocked && shortAddress && (
                            <>
                                <span className="text-gray-400">&gt;</span>
                                <span className="text-[#1E73B8]">
                                    {protectedLocationText}
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

            <div className="bg-white shadow-sm sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <Link to="/" className="flex items-center gap-2 text-[#1E73B8] hover:text-[#1665a0] transition">
                        <FiArrowLeft size={24} />
                        <span className="font-medium">Back to Home</span>
                    </Link>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleToggleFavorite}
                            className={`p-2 rounded-full transition ${isFavorite ? 'bg-red-100 text-red-500' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >
                            <FiHeart size={22} fill={isFavorite ? 'currentColor' : 'none'} />
                        </button>
                        <button className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                            <FiShare2 size={22} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6">
                <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
                    <div className="relative">
                        <div className="aspect-video md:aspect-[21/9] bg-gray-200">
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
                                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition"
                                >
                                    <FiChevronLeft size={20} />
                                </button>
                                <button
                                    onClick={handleNextImage}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full shadow-lg flex items-center justify-center transition"
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

                                <div className="absolute top-4 right-4 bg-black/60 text-white px-3 py-1 rounded-full text-sm">
                                    {currentImageIndex + 1} / {images.length}
                                </div>
                            </>
                        )}
                    </div>

                    {images.length > 1 && (
                        <div className="p-4 flex gap-3 overflow-x-auto">
                            {images.map((img, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setCurrentImageIndex(idx)}
                                    className={`flex-shrink-0 w-20 h-16 rounded-lg overflow-hidden border-2 transition ${currentImageIndex === idx ? 'border-[#1E73B8]' : 'border-transparent'}`}
                                >
                                    <img src={img} alt={`Thumbnail ${idx + 1}`} className="w-full h-full object-cover" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div>
                                    <div className='flex items-center gap-3 mb-2'>
                                        {lists.property_id_number && (
                                            <p className='text-[#1E73B8] text-sm font-bold'>
                                                Property ID: #{lists.property_id_number}
                                            </p>
                                        )}
                                    </div>
                                    <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                                        {lists.property_type || 'Property'}
                                    </h1>
                                    <div className="flex items-center gap-2 text-gray-600">
                                        <FiMapPin className="text-[#1E73B8]" />
                                        <span>{visibleLocationText}</span>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-3xl md:text-4xl font-bold text-[#1E73B8]">
                                        BDT {pricing.rent_amount_bdt || 'N/A'}
                                    </p>
                                    <p className="text-gray-500">/ {pricing.rent_period || 'month'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t">
                                <div className="text-center p-3 bg-blue-50 rounded-xl">
                                    <FiHome className="mx-auto text-[#1E73B8] mb-1" size={24} />
                                    <p className="text-sm text-gray-600">Category</p>
                                    <p className="font-semibold">{lists.category || 'N/A'}</p>
                                </div>
                                <div className="text-center p-3 bg-blue-50 rounded-xl">
                                    <FiLayers className="mx-auto text-[#1E73B8] mb-1" size={24} />
                                    <p className="text-sm text-gray-600">Type</p>
                                    <p className="font-semibold">{lists.property_type || 'N/A'}</p>
                                </div>
                                <div className="text-center p-3 bg-blue-50 rounded-xl">
                                    <FiUsers className="mx-auto text-[#1E73B8] mb-1" size={24} />
                                    <p className="text-sm text-gray-600">Floor</p>
                                    <p className="font-semibold">{specifications.floor_level || lists.floor_level || 'N/A'}</p>
                                </div>
                                <div className="text-center p-3 bg-blue-50 rounded-xl">
                                    <FiMaximize2 className="mx-auto text-[#1E73B8] mb-1" size={24} />
                                    <p className="text-sm text-gray-600">Bathrooms</p>
                                    <p className="font-semibold">{specifications.total_bathrooms || lists.total_bathrooms || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-4 mt-4">
                                <div className="text-center p-3 bg-green-50 rounded-xl">
                                    <p className="text-sm text-gray-600">Dining</p>
                                    <p className="font-semibold text-green-700">
                                        {lists.dining_rooms ?? specifications.dining_rooms ?? 0}
                                    </p>
                                </div>
                                <div className="text-center p-3 bg-yellow-50 rounded-xl">
                                    <p className="text-sm text-gray-600">Living</p>
                                    <p className="font-semibold text-yellow-700">
                                        {lists.living_rooms ?? specifications.living_rooms ?? 0}
                                    </p>
                                </div>
                                <div className="text-center p-3 bg-purple-50 rounded-xl">
                                    <p className="text-sm text-gray-600">Balcony</p>
                                    <p className="font-semibold text-purple-700">
                                        {lists.balcony ?? specifications.total_balcony ?? specifications.balcony ?? 0}
                                    </p>
                                </div>
                                <div className="text-center p-3 bg-orange-50 rounded-xl">
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

                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Description</h2>
                            <p className="text-gray-600 leading-relaxed">
                                {location.short_description || location.description || 'No description available for this property.'}
                            </p>
                        </div>

                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h2 className="text-xl font-bold text-gray-900 mb-4">Facilities</h2>
                            {amenities.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                        <div className="bg-white rounded-2xl shadow-lg p-6 sticky top-24">
                            <h3 className="text-lg font-bold text-gray-900 mb-4">Contact Information</h3>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                                    <div className="w-10 h-10 bg-[#1E73B8] rounded-full flex items-center justify-center">
                                        <FiPhone className="text-white" size={18} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Contact Number</p>
                                        <p className="font-semibold text-gray-900">
                                            {isProtectedUnlocked ? (location.contact_number || 'N/A') : 'Unlock to view contact number'}
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl">
                                    <div className="w-10 h-10 bg-[#1E73B8] rounded-full flex items-center justify-center">
                                        <FiMapPin className="text-white" size={18} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Short Address</p>
                                        <p className="font-semibold text-gray-900">
                                            {isProtectedUnlocked ? protectedLocationText : 'Unlock to view short address'}
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
                            ) : (
                                renderUnlockPanel()
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowContactModal(false)}>
                    <div className="bg-white rounded-2xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
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
                                    {isProtectedUnlocked ? protectedLocationText : 'Unlock to view short address'}
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
                            ) : (
                                renderUnlockPanel()
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Listdetails;
