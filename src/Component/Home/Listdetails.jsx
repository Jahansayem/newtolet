import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useLocation, Link } from 'react-router-dom';
import {
    FiMapPin,
    FiPhone,
    FiHome,
    FiLayers,
    FiMaximize2,
    FiHeart,
    FiShare2,
    FiChevronLeft,
    FiChevronRight,
    FiLock,
    FiCopy,
    FiCheck,
    FiSun,
    FiCoffee,
    FiGrid,
    FiShield,
} from 'react-icons/fi';
import { LuBath, LuBedDouble } from 'react-icons/lu';
import useHydratedSnapshot from '../../hooks/useHydratedSnapshot';
import { useDocumentHead } from '../../lib/seo/useDocumentHead.js';
import { listingDescription, listingDocumentTitle, listingJsonLd } from '../../lib/seo/jsonLd.js';
import { SITE_URL } from '../../lib/seo/siteMeta.js';
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
import { trackEvent } from '../../services/customerEventsService';
import dynamic from 'next/dynamic';
import { getListingExtras, getSimilarProperties, getVerifiedOwnerPropertyIds } from '../../services/propertyCatalogService';
import { VerifiedOwnerBadge, WhatsAppContactButton } from '../../components/listing/ListingTrust';
import ReportListingDialog from '../../components/listing/ReportListingDialog';
import PropertyListingCard from '../../components/PropertyListingCard';
import { getListingMapLocation } from '../../data/locationCentroids';
import { FiFlag } from 'react-icons/fi';

// Leaflet only loads on detail pages, after the main content.
const ListingMap = dynamic(() => import('../../components/Maps/ListingMap'), { ssr: false });
import RentDisplay from '../../components/RentDisplay';
import { PropertyThumbnailImage } from '../../components/PropertyCardMedia';
import Dialog from '../../components/ui/Dialog';
import { isRentNegotiable } from '../../utils/rentDisplay';
import { getPropertyIdNumber } from '../../utils/propertyDisplaySerial';
import { useLanguage } from '../../i18n/useLanguage';
import { translate, readStoredLanguage } from '../../i18n';

const hasValue = (value) => value !== null && value !== undefined && value !== '';

const DetailSkeleton = () => (
    <div className="site-shell py-6" aria-busy="true" aria-hidden="true">
        <div className="mb-6 aspect-[4/3] w-full animate-pulse rounded-2xl bg-slate-200 sm:aspect-video sm:max-h-[480px]" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
            <div className="space-y-6">
                <div className="ui-card animate-pulse space-y-4 p-6">
                    <div className="h-8 w-2/3 rounded-md bg-slate-200" />
                    <div className="h-4 w-1/2 rounded-md bg-slate-200" />
                    <div className="h-10 w-48 rounded-md bg-slate-200" />
                    <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <div key={index} className="h-20 rounded-xl bg-slate-200" />
                        ))}
                    </div>
                </div>
                <div className="ui-card h-40 animate-pulse p-6" />
            </div>
            <div className="ui-card h-80 animate-pulse p-6" />
        </div>
    </div>
);

const Listdetails = () => {
    const [searchParams] = useSearchParams();
    const id = searchParams.get('id') || '';
    const { t, tv } = useLanguage();
    const routerLocation = useLocation();
    const { user, session, updateUserInContext } = useAuth();
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
    // Holds a dictionary key so the message follows the active language.
    const [loadError, setLoadError] = useState(null);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [isFavorite, setIsFavorite] = useState(false);
    const [showContactModal, setShowContactModal] = useState(false);
    const [showUnlockModal, setShowUnlockModal] = useState(false);
    const [unlockCost, setUnlockCost] = useState(20);
    const [currentCredits, setCurrentCredits] = useState(0);
    const [unlockError, setUnlockError] = useState('');
    const [isUnlocking, setIsUnlocking] = useState(false);
    const [shareStatus, setShareStatus] = useState('');
    // 'copied' | 'failed' | '' — feedback for the Property ID copy button.
    const [idCopyStatus, setIdCopyStatus] = useState('');

    // Per-listing <title>, canonical, Open Graph and schema.org JSON-LD (static export: set in the browser).
    const documentHead = useMemo(() => {
        if (!lists?.id) return null;
        const flat = {
            id: lists.id,
            property_type: lists.property_type,
            category: lists.category,
            total_rooms: lists.total_rooms ?? lists.specifications?.total_rooms,
            total_bathrooms: lists.total_bathrooms ?? lists.specifications?.total_bathrooms,
            size_sqft: lists.room_size_sqft ?? lists.room_size ?? lists.specifications?.room_size,
            area: lists.location?.area,
            state_district: lists.location?.state_district,
            short_description: lists.location?.short_description,
            rent_amount_bdt: lists.pricing?.rent_amount_bdt,
            is_rent_negotiable: lists.pricing?.is_rent_negotiable,
            created_at: lists.created_at,
            lat: lists.lat,
            lng: lists.lng,
        };
        const images = [...(Array.isArray(lists.images) ? lists.images : []), lists.primary_image]
            .filter((image) => typeof image === 'string' && /^https?:/.test(image));
        const canonicalPath = `/listdetails/?id=${lists.id}`;
        return {
            title: listingDocumentTitle(flat),
            description: listingDescription(flat),
            canonicalPath,
            image: images[0],
            jsonLd: listingJsonLd(flat, { url: `${SITE_URL}${canonicalPath}`, images }),
        };
    }, [lists]);
    useDocumentHead(documentHead);

    useEffect(() => {
        if (!idCopyStatus) {
            return undefined;
        }
        const timer = setTimeout(() => setIdCopyStatus(''), 2000);
        return () => clearTimeout(timer);
    }, [idCopyStatus]);

    useEffect(() => {
        if (!shareStatus) {
            return undefined;
        }

        const timer = setTimeout(() => setShareStatus(''), 2500);
        return () => clearTimeout(timer);
    }, [shareStatus]);

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
        if (!isHydrated) {
            return;
        }

        let isMounted = true;

        const loadProperty = async () => {
            if (!id) {
                setLists(null);
                setLoadError('listing.detail.errors.missingId');
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
                const errorMsg = error?.message || error?.toString() || translate(readStoredLanguage(), 'listing.detail.unknownError');

                // Only log for non-quota errors to reduce console noise
                if (!errorMsg.includes('temporarily unavailable')) {
                    console.error('Error loading property details:', errorMsg, { id });
                }

                // Show user-friendly error messages
                let displayError = 'listing.detail.errors.notFound';
                if (errorMsg.includes('temporarily unavailable')) {
                    displayError = 'listing.detail.errors.temporarilyUnavailable';
                } else if (!errorMsg.includes('not found')) {
                    displayError = 'listing.detail.errors.loadFailed';
                }

                if (isMounted && !hasCachedProperty) {
                    setLists(null);
                    setLoadError(displayError);
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

    const [listingExtras, setListingExtras] = useState({ whatsappEnabled: false, expiresAt: null });
    const [ownerVerified, setOwnerVerified] = useState(false);
    const [similarProperties, setSimilarProperties] = useState([]);
    const [isReportOpen, setIsReportOpen] = useState(false);

    useEffect(() => {
        if (!lists?.id) {
            return undefined;
        }

        let active = true;
        setListingExtras({ whatsappEnabled: false, expiresAt: null });
        setOwnerVerified(false);
        setSimilarProperties([]);

        Promise.all([
            getListingExtras(lists.id),
            getVerifiedOwnerPropertyIds([lists.id]),
            getSimilarProperties(lists),
        ]).then(([extras, verifiedIds, similar]) => {
            if (!active) return;
            setListingExtras(extras);
            setOwnerVerified(verifiedIds.has(lists.id));
            setSimilarProperties(similar);
        });

        return () => {
            active = false;
        };
        // Reload only when a different listing opens, not when the cached copy is refreshed.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lists?.id]);

    useEffect(() => {
        if (!id || !lists?.id || lists.id !== id) {
            return;
        }

        // Anonymous and signed-in visitors alike; once per listing per tab.
        trackEvent('listing_view', { propertyId: id, metadata: { category: lists.category || null, district: lists.state_district || null } });
    }, [id, lists?.id, lists?.category, lists?.state_district]);

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
            setUnlockError(t('listing.detail.unlock.errors.loginRequired'));
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
                setUnlockError(t('listing.detail.unlock.errors.notEnoughPoints'));
            } else if (normalizedMessage.toLowerCase().includes('schema cache') || normalizedMessage.toLowerCase().includes('could not find the function')) {
                setUnlockError(t('listing.detail.unlock.errors.temporarilyUnavailable'));
            } else {
                setUnlockError(normalizedMessage || t('listing.detail.unlock.errors.failed'));
            }
        } finally {
            setIsUnlocking(false);
        }
    };

    const handleToggleFavorite = async () => {
        try {
            const result = await toggleSavedProperty(user?.id || null, id);
            setIsFavorite(Boolean(result?.saved));
            // Visible confirmation (the audit found saving gave no feedback).
            setShareStatus(result?.saved ? 'saved' : 'removed');
        } catch (error) {
            console.error('Error toggling favorite property:', error);
            setShareStatus('saveFailed');
        }
    };

    const handleCopyPropertyId = async (value) => {
        try {
            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(String(value));
                setIdCopyStatus('copied');
                return;
            }
            setIdCopyStatus('failed');
        } catch {
            setIdCopyStatus('failed');
        }
    };

    const handleShare = async () => {
        const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
        const shareTitle = typeof document !== 'undefined' ? document.title : '';

        try {
            if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
                await navigator.share({ title: shareTitle, url: shareUrl });
                return;
            }

            if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
                await navigator.clipboard.writeText(shareUrl);
                setShareStatus('copied');
                return;
            }

            setShareStatus('failed');
        } catch (error) {
            if (error?.name !== 'AbortError') {
                setShareStatus('failed');
            }
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen">
                <p className="sr-only" role="status">{t('listing.detail.loading')}</p>
                <DetailSkeleton />
            </div>
        );
    }

    if (!lists || loadError) {
        const isNotFound = !loadError || loadError === 'listing.detail.errors.notFound' || loadError === 'listing.detail.errors.missingId';

        return (
            <div className="site-shell flex min-h-[60vh] items-center justify-center py-10">
                <div className="ui-panel w-full max-w-md p-8 text-center" role="alert">
                    <h1 className="text-xl font-bold text-ink">
                        {isNotFound ? t('listing.detail.notFound') : t('listing.detail.unavailableTitle')}
                    </h1>
                    <p className="mt-2 text-body text-muted">{loadError ? t(loadError) : t('listing.detail.unavailable')}</p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                        {!isNotFound ? (
                            <button type="button" onClick={() => window.location.reload()} className="ui-btn ui-btn-secondary">
                                {t('common.retry')}
                            </button>
                        ) : null}
                        <Link to="/propertylist2" className="ui-btn ui-btn-primary">
                            {t('listing.detail.browseProperties')}
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const location = lists.location || {};
    const pricing = lists.pricing || {};
    const isNegotiableRent = isRentNegotiable(pricing);
    const specifications = lists.specifications || {};
    const amenities = lists.amenities || [];
    const images = [
        ...(Array.isArray(lists.images) ? lists.images : []),
        lists.primary_image,
        lists.image_url,
    ].filter((image, index, imageList) => (
        typeof image === 'string' &&
        image.trim() !== '' &&
        imageList.indexOf(image) === index
    ));
    const propertyIdNumber = getPropertyIdNumber(lists);
    const mapLocation = getListingMapLocation({
        lat: lists.lat,
        lng: lists.lng,
        state_district: location.state_district,
        area: location.area,
        sub_area: location.sub_area,
    });
    const isProtectedUnlocked = Boolean(lists.protected_contact_unlocked);
    const hasEnoughPoints = currentCredits >= unlockCost;
    const publicLocationText = [location.sub_area, location.area, location.state_district].filter(Boolean).join(', ');
    const protectedLocationText = [location.house_plot, location.road, location.sector].filter(Boolean).join(', ');
    const visibleLocationText = publicLocationText || location.state_district || t('listing.detail.defaultCountry');
    const imageLocationLabel = location.area || location.state_district || t('listing.detail.defaultCountry');
    const propertyTitle = tv('propertyTypes', lists.property_type) || t('listing.detail.propertyFallback');
    const categoryLabel = tv('categories', lists.category) || t('listing.detail.categoryFallback');
    // Split the translated template around {points} so the points keep their own styling.
    const [confirmDescriptionBefore, confirmDescriptionAfter] = t('listing.detail.unlock.confirmDescription').split('{points}');

    const bedrooms = lists.total_rooms ?? specifications.total_rooms;
    const bathrooms = lists.total_bathrooms ?? specifications.total_bathrooms;
    const floorLevel = lists.floor_level ?? specifications.floor_level;
    const roomSize = lists.room_size_sqft ?? specifications.room_size;
    const balconyCount = lists.balcony ?? specifications.total_balcony ?? specifications.balcony;
    const kitchenCount = lists.kitchen ?? lists.total_kitchen ?? specifications.total_kitchen ?? specifications.kitchen;
    const hasDrawingRoom = Number(lists.living_rooms ?? specifications.living_rooms ?? 0) > 0;
    const diningRooms = lists.dining_rooms ?? specifications.dining_rooms;

    const specTiles = [
        { key: 'bedrooms', icon: LuBedDouble, label: t('listing.detail.specs.bedrooms'), value: hasValue(bedrooms) ? bedrooms : t('common.na') },
        { key: 'bathrooms', icon: LuBath, label: t('listing.detail.specs.bathrooms'), value: hasValue(bathrooms) ? bathrooms : t('common.na') },
        { key: 'floor', icon: FiLayers, label: t('listing.detail.specs.floor'), value: hasValue(floorLevel) ? floorLevel : t('common.na') },
        ...(hasValue(roomSize) ? [{ key: 'size', icon: FiMaximize2, label: t('listing.detail.specs.size'), value: t('listing.detail.specs.sizeValue', { size: roomSize }) }] : []),
        { key: 'balcony', icon: FiSun, label: t('listing.detail.specs.balcony'), value: hasValue(balconyCount) ? balconyCount : 0 },
        { key: 'kitchen', icon: FiCoffee, label: t('listing.detail.specs.kitchen'), value: hasValue(kitchenCount) ? kitchenCount : 0 },
        { key: 'drawingRoom', icon: FiHome, label: t('listing.detail.specs.drawingRoom'), value: hasDrawingRoom ? t('common.yes') : t('common.no') },
        { key: 'dining', icon: FiGrid, label: t('listing.detail.specs.rooms'), value: hasValue(diningRooms) ? diningRooms : 0 },
    ];

    const handlePrevImage = () => {
        setCurrentImageIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    };

    const handleNextImage = () => {
        setCurrentImageIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    };

    const renderLockedRow = (icon, label, value) => (
        <div className="flex items-start gap-3 rounded-xl border border-line bg-canvas p-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
                {icon}
            </div>
            <div className="min-w-0">
                <p className="text-caption text-muted">{label}</p>
                <p className="break-words font-semibold text-ink">{value}</p>
            </div>
        </div>
    );

    const renderGuestContactPanel = () => (
        <div className="mt-5 space-y-3">
            <p className="text-base font-semibold text-ink">{t('listing.detail.guest.title')}</p>
            <p className="text-caption text-muted">{t('listing.detail.guest.description')}</p>
            <Link
                to="/login"
                state={{ from: `${routerLocation.pathname}${routerLocation.search || ''}` }}
                className="ui-btn ui-btn-primary w-full"
            >
                <FiLock className="text-base" aria-hidden="true" />
                <span>{t('listing.detail.guest.login')}</span>
            </Link>
            <Link to="/terms" className="inline-flex min-h-9 items-center text-caption text-muted underline underline-offset-2 hover:text-ink">
                {t('listing.detail.guest.terms')}
            </Link>
        </div>
    );

    const renderLockedUnlockPanel = () => (
        <div className="mt-5 space-y-3">
            <p className="text-base font-semibold text-ink">{t('listing.detail.unlock.title')}</p>
            <p className="text-caption text-muted">{t('listing.detail.unlock.description')}</p>
            <p className="text-caption text-muted">
                {t('listing.detail.unlock.availablePoints')} <span className="font-semibold text-ink">{currentCredits}</span>
            </p>
            {unlockError && (
                <p role="alert" className="ui-note ui-note-danger text-danger">
                    {unlockError}
                </p>
            )}
            <button
                type="button"
                onClick={() => {
                    setUnlockError('');
                    setShowUnlockModal(true);
                }}
                disabled={isUnlocking}
                className="ui-btn ui-btn-primary w-full"
            >
                <FiLock className="text-base" aria-hidden="true" />
                <span>{isUnlocking ? t('listing.detail.unlock.unlocking') : t('listing.detail.unlock.button')}</span>
            </button>
        </div>
    );

    const renderUnlockedActions = () => (
        <div className="mt-5 space-y-3">
            <button
                type="button"
                onClick={() => setShowContactModal(true)}
                className="ui-btn ui-btn-primary w-full"
            >
                <FiPhone className="text-base" aria-hidden="true" />
                <span>{t('listing.detail.contact.contactOwner')}</span>
            </button>
            {location.contact_number ? (
                <a href={`tel:${location.contact_number}`} className="ui-btn ui-btn-secondary w-full" onClick={() => trackEvent('phone_tap', { propertyId: id, metadata: { placement: 'sidebar' } })}>
                    <FiPhone className="text-base" aria-hidden="true" />
                    <span>{t('listing.detail.contact.callNow')}</span>
                </a>
            ) : null}
            {location.contact_number && listingExtras.whatsappEnabled ? (
                <WhatsAppContactButton
                    phone={location.contact_number}
                    message={t('listing.trust.whatsappMessage', { id: getPropertyIdNumber(lists) || '' })}
                    onClick={() => trackEvent('whatsapp_tap', { propertyId: id, metadata: { placement: 'sidebar' } })}
                />
            ) : null}
        </div>
    );

    return (
        <div className="min-h-screen pb-10">
            {/* Sticky bar: breadcrumb + save/share. One bar instead of two. */}
            <div className="sticky top-[var(--nav-h)] z-40 border-b border-line bg-white/95 backdrop-blur">
                <div className="site-shell flex items-center justify-between gap-3 py-2.5">
                    <nav aria-label={t('listing.detail.breadcrumb')} className="min-w-0">
                        <ol className="flex min-w-0 items-center gap-1.5 text-caption text-muted">
                            <li className="shrink-0">
                                <Link to="/" className="inline-flex min-h-9 items-center text-brand hover:text-brand-pressed">{t('common.home')}</Link>
                            </li>
                            <li className="shrink-0" aria-hidden="true">/</li>
                            <li className="shrink-0">
                                <Link to="/propertylist2" className="inline-flex min-h-9 items-center text-brand hover:text-brand-pressed">
                                    {location.state_district || tv('divisions', 'Dhaka')}
                                </Link>
                            </li>
                            {Boolean(location.area || location.sub_area) && (
                                <>
                                    <li className="shrink-0" aria-hidden="true">/</li>
                                    <li className="hidden min-w-0 truncate sm:block">
                                        {[location.sub_area, location.area].filter(Boolean).join(', ')}
                                    </li>
                                </>
                            )}
                            <li className="hidden shrink-0 sm:block" aria-hidden="true">/</li>
                            <li className="shrink-0 font-medium text-ink" aria-current="page">{categoryLabel}</li>
                        </ol>
                    </nav>
                    <div className="flex shrink-0 items-center gap-1.5">
                        <span
                            role="status"
                            aria-live="polite"
                            className={shareStatus ? `text-caption font-medium ${shareStatus === 'failed' || shareStatus === 'saveFailed' ? 'text-danger' : 'text-success'}` : 'sr-only'}
                        >
                            {shareStatus === 'copied'
                                ? t('listing.detail.share.copied')
                                : shareStatus === 'failed'
                                    ? t('listing.detail.share.failed')
                                    : shareStatus === 'saved'
                                        ? t('listing.card.savedStatus')
                                        : shareStatus === 'removed'
                                            ? t('listing.card.removedStatus')
                                            : shareStatus === 'saveFailed'
                                                ? t('listing.card.saveFailed')
                                                : ''}
                        </span>
                        <button
                            type="button"
                            onClick={handleToggleFavorite}
                            aria-pressed={isFavorite}
                            aria-label={isFavorite ? t('listing.detail.aria.unsave') : t('listing.detail.aria.save')}
                            className={`ui-btn ui-btn-icon-lg ${isFavorite ? 'bg-danger-soft text-danger' : 'ui-btn-secondary text-muted hover:text-danger'}`}
                        >
                            <FiHeart size={20} fill={isFavorite ? 'currentColor' : 'none'} aria-hidden="true" />
                        </button>
                        <button
                            type="button"
                            onClick={handleShare}
                            aria-label={t('listing.detail.aria.share')}
                            className="ui-btn ui-btn-secondary ui-btn-icon-lg text-muted"
                        >
                            <FiShare2 size={20} aria-hidden="true" />
                        </button>
                    </div>
                </div>
            </div>

            <div className="site-shell py-5 md:py-6">
                <div className="site-card-strong mb-6 overflow-hidden">
                    <div className="relative">
                        <div className="aspect-[4/3] bg-slate-200 sm:aspect-video sm:max-h-[480px]">
                            <PropertyThumbnailImage
                                src={images[currentImageIndex] || images[0]}
                                alt={t('listing.detail.imageAlt', {
                                    type: propertyTitle,
                                    location: imageLocationLabel,
                                })}
                                className="h-full w-full object-cover"
                                fallbackClassName="h-full w-full"
                                propertyType={lists.property_type}
                                category={lists.category}
                                pricing={pricing}
                                loading="eager"
                                showRent={false}
                            />
                        </div>

                        {images.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={handlePrevImage}
                                    aria-label={t('listing.detail.aria.previousImage')}
                                    className="ui-btn ui-btn-icon-lg absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 text-ink shadow-raised hover:bg-white sm:left-4"
                                >
                                    <FiChevronLeft size={22} aria-hidden="true" />
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNextImage}
                                    aria-label={t('listing.detail.aria.nextImage')}
                                    className="ui-btn ui-btn-icon-lg absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 text-ink shadow-raised hover:bg-white sm:right-4"
                                >
                                    <FiChevronRight size={22} aria-hidden="true" />
                                </button>

                                <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1">
                                    {images.map((_, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => setCurrentImageIndex(idx)}
                                            aria-label={t('listing.detail.aria.goToImage', { number: idx + 1 })}
                                            aria-current={currentImageIndex === idx ? 'true' : undefined}
                                            className="flex h-6 w-6 items-center justify-center rounded-full"
                                        >
                                            <span className={`block h-2 rounded-full transition-all ${currentImageIndex === idx ? 'w-6 bg-white' : 'w-2 bg-white/60'}`} />
                                        </button>
                                    ))}
                                </div>

                                <div className="absolute right-3 top-3 rounded-full bg-ink/70 px-2.5 py-1 text-caption font-medium text-white sm:right-4 sm:top-4">
                                    {currentImageIndex + 1} / {images.length}
                                </div>
                            </>
                        )}
                    </div>

                    {images.length > 1 && (
                        <div className="flex gap-2 overflow-x-auto p-3 scrollbar-hide">
                            {images.map((img, idx) => (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => setCurrentImageIndex(idx)}
                                    aria-label={t('listing.detail.aria.goToImage', { number: idx + 1 })}
                                    aria-pressed={currentImageIndex === idx}
                                    className={`h-16 w-20 flex-shrink-0 overflow-hidden rounded-xl border-2 transition sm:h-20 sm:w-28 ${currentImageIndex === idx ? 'border-brand' : 'border-transparent hover:border-line'}`}
                                >
                                    <PropertyThumbnailImage
                                        src={img}
                                        alt={t('listing.detail.thumbnailAlt', { number: idx + 1 })}
                                        className="h-full w-full object-cover"
                                        fallbackClassName="h-full w-full"
                                        propertyType={lists.property_type}
                                        category={lists.category}
                                        pricing={pricing}
                                        compact
                                    />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,1fr)]">
                    <div className="space-y-6">
                        {/* Title → location → price → quotable ID. */}
                        <section className="ui-card p-5 sm:p-6" aria-labelledby="listing-title">
                            <p className="ui-eyebrow">{categoryLabel}</p>
                            <h1 id="listing-title" className="mt-2 text-2xl font-bold leading-tight text-ink md:text-3xl">
                                {propertyTitle}
                            </h1>
                            {ownerVerified ? <VerifiedOwnerBadge className="mt-2" /> : null}
                            {listingExtras.expiresAt && new Date(listingExtras.expiresAt).getTime() < Date.now() ? (
                                <p role="status" className="ui-note mt-3">{t('listing.trust.expired')}</p>
                            ) : null}
                            <p className="mt-2 flex items-start gap-2 text-body text-muted">
                                <FiMapPin className="mt-1 shrink-0 text-brand" aria-hidden="true" />
                                <span>{visibleLocationText}</span>
                            </p>

                            <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-line pt-5">
                                <div>
                                    <p className="text-caption text-muted">{t('listing.detail.rentLabel')}</p>
                                    {isNegotiableRent ? (
                                        <p className="mt-1"><span className="ui-badge ui-badge-neutral text-base">{t('listing.negotiable')}</span></p>
                                    ) : (
                                        <p className="ui-price mt-1 text-[28px] leading-9 md:text-[32px] md:leading-10">
                                            <RentDisplay pricing={pricing} prefix="৳ " />
                                            <span className="ml-1.5 text-base font-medium text-muted">
                                                / {pricing.rent_period ? tv('rentPeriods', pricing.rent_period) : t('common.perMonth')}
                                            </span>
                                        </p>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-caption text-muted">{t('listing.detail.propertyId.title')}</span>
                                    {propertyIdNumber ? (
                                        <>
                                            <span className="ui-id-ticket text-base" title={t('listing.card.idTicketTitle')}>{propertyIdNumber}</span>
                                            <button
                                                type="button"
                                                onClick={() => handleCopyPropertyId(propertyIdNumber)}
                                                className="ui-btn ui-btn-secondary ui-btn-sm"
                                            >
                                                {idCopyStatus === 'copied' ? <FiCheck className="text-success" aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
                                                <span>{t('listing.detail.propertyId.copy')}</span>
                                            </button>
                                            <span
                                                role="status"
                                                aria-live="polite"
                                                className={idCopyStatus ? `text-caption font-medium ${idCopyStatus === 'failed' ? 'text-danger' : 'text-success'}` : 'sr-only'}
                                            >
                                                {idCopyStatus === 'copied'
                                                    ? t('listing.detail.propertyId.copied')
                                                    : idCopyStatus === 'failed'
                                                        ? t('listing.detail.propertyId.failed')
                                                        : ''}
                                            </span>
                                        </>
                                    ) : (
                                        <span className="text-caption text-muted">{t('listing.detail.propertyId.unavailable')}</span>
                                    )}
                                </div>
                            </div>

                            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                                {specTiles.map((tile) => (
                                    <div key={tile.key} className="rounded-xl border border-line bg-canvas p-3">
                                        <dt className="flex items-center gap-1.5 text-caption text-muted">
                                            <tile.icon className="text-base text-brand" aria-hidden="true" />
                                            <span>{tile.label}</span>
                                        </dt>
                                        <dd className="mt-1 text-base font-semibold text-ink">{tile.value}</dd>
                                    </div>
                                ))}
                            </dl>

                            {lists.occupancy && (
                                <div className="ui-note mt-4">
                                    <p className="font-semibold text-ink">{t('listing.detail.occupancyRestrictions')}</p>
                                    <p className="mt-0.5 text-muted">{lists.occupancy}</p>
                                </div>
                            )}
                        </section>

                        <section className="ui-card p-5 sm:p-6" aria-labelledby="listing-description">
                            <h2 id="listing-description" className="text-lg font-bold text-ink">{t('listing.detail.description')}</h2>
                            <p className="mt-3 max-w-[70ch] text-body text-muted">
                                {location.short_description || location.description || t('listing.detail.noDescription')}
                            </p>
                        </section>

                        <section className="ui-card p-5 sm:p-6" aria-labelledby="listing-facilities">
                            <h2 id="listing-facilities" className="text-lg font-bold text-ink">{t('listing.detail.facilities')}</h2>
                            {amenities.length > 0 ? (
                                <ul className="mt-3 grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 md:grid-cols-3">
                                    {amenities.map((amenity, idx) => (
                                        <li key={idx} className="flex items-center gap-2 text-body text-ink">
                                            <FiCheck className="shrink-0 text-success" aria-hidden="true" />
                                            <span>{tv('amenities', amenity)}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="mt-3 text-body text-muted">{t('listing.detail.noFacilities')}</p>
                            )}
                        </section>

                        {mapLocation ? (
                            <section className="ui-card p-5 sm:p-6" aria-labelledby="listing-map">
                                <h2 id="listing-map" className="text-lg font-bold text-ink">{t('listing.trust.mapTitle')}</h2>
                                <p className="mt-1 text-caption text-muted">
                                    {mapLocation.precision === 'exact'
                                        ? t('listing.trust.mapExact')
                                        : mapLocation.precision === 'area'
                                            ? t('listing.trust.mapArea')
                                            : t('listing.trust.mapDistrict')}
                                </p>
                                <ListingMap
                                    className="mt-4"
                                    height={300}
                                    ariaLabel={t('listing.trust.mapLabel')}
                                    points={[{ id: lists.id, ...mapLocation, label: visibleLocationText }]}
                                />
                                <a
                                    href={`https://www.google.com/maps/search/?api=1&query=${mapLocation.lat},${mapLocation.lng}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ui-btn ui-btn-ghost ui-btn-sm mt-3 text-brand"
                                >
                                    {t('listing.trust.openInMaps')}
                                </a>
                            </section>
                        ) : null}
                    </div>

                    <aside>
                        <div className="ui-card p-5 sm:p-6 xl:sticky xl:top-[calc(var(--nav-h)+1rem)]">
                            <h2 className="text-lg font-bold text-ink">{t('listing.detail.contact.title')}</h2>

                            <div className="mt-4 space-y-3">
                                {renderLockedRow(
                                    isProtectedUnlocked ? <FiPhone size={18} aria-hidden="true" /> : <FiLock size={18} aria-hidden="true" />,
                                    t('listing.detail.contact.number'),
                                    isProtectedUnlocked ? (location.contact_number || t('common.na')) : t('listing.detail.contact.unlockToViewNumber')
                                )}
                                {renderLockedRow(
                                    isProtectedUnlocked ? <FiMapPin size={18} aria-hidden="true" /> : <FiLock size={18} aria-hidden="true" />,
                                    t('listing.detail.contact.shortAddress'),
                                    isProtectedUnlocked ? (protectedLocationText || t('listing.detail.contact.shortAddressUnavailable')) : t('listing.detail.contact.unlockToViewAddress')
                                )}
                            </div>

                            {isProtectedUnlocked
                                ? renderUnlockedActions()
                                : !user?.id
                                    ? renderGuestContactPanel()
                                    : renderLockedUnlockPanel()}

                            <div className="ui-note mt-6">
                                <p className="flex items-center gap-2 font-semibold text-ink">
                                    <FiShield className="text-brand" aria-hidden="true" />
                                    <span>{t('listing.detail.safety.title')}</span>
                                </p>
                                <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
                                    <li>{t('listing.detail.safety.meetSafe')}</li>
                                    <li>{t('listing.detail.safety.verify')}</li>
                                    <li>{t('listing.detail.safety.noAdvance')}</li>
                                </ul>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsReportOpen(true)}
                                className="ui-btn ui-btn-ghost ui-btn-sm mt-4 w-full text-muted hover:text-danger"
                            >
                                <FiFlag aria-hidden="true" />
                                <span>{t('listing.trust.report')}</span>
                            </button>
                        </div>
                    </aside>
                </div>

                {similarProperties.length > 0 ? (
                    <section className="mt-10" aria-labelledby="similar-listings">
                        <h2 id="similar-listings" className="mb-4 text-xl font-bold text-ink">{t('listing.trust.similarTitle')}</h2>
                        <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                            {similarProperties.map((item, index) => (
                                <PropertyListingCard key={item.id} item={item} index={index} />
                            ))}
                        </div>
                    </section>
                ) : null}
            </div>

            <ReportListingDialog
                open={isReportOpen}
                onClose={() => setIsReportOpen(false)}
                propertyId={lists.id}
                subtitle={propertyTitle}
            />

            <Dialog
                open={showContactModal}
                onClose={() => setShowContactModal(false)}
                title={t('listing.detail.contact.contactOwner')}
                closeLabel={t('listing.detail.aria.closeDialog')}
                size="sm"
            >
                <div className="space-y-4">
                    <dl className="rounded-xl border border-line bg-canvas p-4 text-body">
                        <dt className="text-caption text-muted">{t('listing.detail.contact.property')}</dt>
                        <dd className="font-semibold text-ink">{propertyTitle}</dd>
                        <dt className="mt-3 text-caption text-muted">{t('listing.detail.contact.district')}</dt>
                        <dd className="font-semibold text-ink">{location.state_district || t('common.na')}</dd>
                        <dt className="mt-3 text-caption text-muted">{t('listing.detail.contact.shortAddress')}</dt>
                        <dd className="font-semibold text-ink">
                            {isProtectedUnlocked ? (protectedLocationText || t('listing.detail.contact.shortAddressUnavailable')) : t('listing.detail.contact.unlockToViewAddress')}
                        </dd>
                    </dl>

                    {isProtectedUnlocked ? (
                        location.contact_number ? (
                            <a href={`tel:${location.contact_number}`} className="ui-btn ui-btn-primary w-full" onClick={() => trackEvent('phone_tap', { propertyId: id, metadata: { placement: 'contact_dialog' } })}>
                                <FiPhone aria-hidden="true" />
                                <span>{location.contact_number}</span>
                            </a>
                        ) : (
                            <p className="ui-note">{t('listing.detail.contact.numberUnavailable')}</p>
                        )
                    ) : !user?.id ? (
                        renderGuestContactPanel()
                    ) : (
                        renderLockedUnlockPanel()
                    )}
                </div>
            </Dialog>

            <Dialog
                open={showUnlockModal}
                onClose={() => setShowUnlockModal(false)}
                title={t('listing.detail.unlock.confirmTitle')}
                closeLabel={t('listing.detail.aria.closeDialog')}
                dismissible={!isUnlocking}
                size="md"
                footer={(
                    <>
                        <button
                            type="button"
                            onClick={() => setShowUnlockModal(false)}
                            disabled={isUnlocking}
                            className="ui-btn ui-btn-secondary ui-btn-sm"
                        >
                            {t('common.cancel')}
                        </button>
                        {!hasEnoughPoints ? (
                            <Link to="/book/buy-credits" className="ui-btn ui-btn-secondary ui-btn-sm">
                                {t('listing.detail.unlock.buyPoints')}
                            </Link>
                        ) : null}
                        <button
                            type="button"
                            onClick={handleUnlockProtectedInfo}
                            disabled={isUnlocking || !hasEnoughPoints}
                            className="ui-btn ui-btn-primary ui-btn-sm"
                        >
                            <FiLock aria-hidden="true" />
                            <span>{isUnlocking ? t('listing.detail.unlock.unlocking') : t('listing.detail.unlock.confirm')}</span>
                        </button>
                    </>
                )}
            >
                <p className="text-body text-muted">
                    {confirmDescriptionBefore}<span className="font-semibold text-ink">{t('listing.detail.unlock.pointsCount', { count: unlockCost })}</span>{confirmDescriptionAfter}
                </p>

                <dl className="mt-4 rounded-xl border border-line bg-canvas p-4 text-body">
                    <dt className="sr-only">{t('listing.detail.contact.property')}</dt>
                    <dd className="font-semibold text-ink">{propertyTitle}</dd>
                    <dt className="mt-2 inline text-muted">{t('listing.detail.unlock.district')} </dt>
                    <dd className="inline font-medium text-ink">{location.state_district || t('common.na')}</dd>
                    <br />
                    <dt className="mt-1 inline text-muted">{t('listing.detail.unlock.pointsAvailable')} </dt>
                    <dd className="inline font-medium text-ink">{currentCredits}</dd>
                </dl>

                <div className="ui-note mt-4">
                    <p className="font-semibold text-ink">{t('listing.detail.unlock.refundTitle')}</p>
                    <p className="mt-1 text-muted">{t('listing.detail.unlock.refundDescription')}</p>
                    <Link to="/refund" className="mt-2 inline-flex font-semibold text-brand hover:underline">
                        {t('listing.detail.unlock.readRefundPolicy')}
                    </Link>
                </div>

                {!hasEnoughPoints && (
                    <p className="ui-note ui-note-danger mt-4" role="status">
                        {t('listing.detail.unlock.notEnoughPoints')}
                    </p>
                )}

                {unlockError && (
                    <p role="alert" className="ui-note ui-note-danger mt-4 text-danger">
                        {unlockError}
                    </p>
                )}
            </Dialog>
        </div>
    );
};

export default Listdetails;
