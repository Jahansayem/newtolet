import React, { useEffect, useState, useMemo, useRef } from 'react';
import ReactDOM from 'react-dom';
import { RxCross2 } from 'react-icons/rx';
import { Link, useNavigate } from 'react-router-dom';
import { TfiMenu } from 'react-icons/tfi';
import { CgProfile } from "react-icons/cg";
import { TbLogout } from 'react-icons/tb';
import { BiCreditCard, BiHome, BiListUl, BiPlus, BiCart, BiBuildings, BiDollarCircle, BiSearch, BiCoin } from 'react-icons/bi';
import { MdDashboard } from 'react-icons/md';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { HiOutlineClipboardList } from 'react-icons/hi';
import { useAuth } from '../../hooks/useAuth';
import { getAllProperties } from '../../services/propertyService';
import PropertySearchForm from './PropertySearchForm';
import {
    DEFAULT_SEARCH_FILTERS,
    buildSearchHref as buildPropertySearchHref,
    updateSearchFilters,
} from './propertySearch';
import { buildListDetailsHref } from '../../lib/routePaths';

const LOGO_SRC = '/logo.png'
const LOGO_FALLBACK_SRC = '/logo1.png'

// Instant checks from localStorage - no loading needed
const checkAdminInstant = () => {
    if (typeof window === 'undefined') {
        return false;
    }

    try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            const parsedUser = JSON.parse(storedUser);
            return parsedUser.is_admin === true;
        }
    } catch {
        return false;
    }
    return false;
};

const Navber = () => {
    const [mounted, setMounted] = useState(false)
    const [menubtn, setmenubtn] = useState(false)
    const [menu, setMenu] = useState('home')
    const [isAdmin, setIsAdmin] = useState(checkAdminInstant()) // Instant check on mount
    const [showProfileDropdown, setShowProfileDropdown] = useState(false)
    const [showPropertyDropdown, setShowPropertyDropdown] = useState(false)
    const [mobilePropertyDropdown, setMobilePropertyDropdown] = useState(false)
    const [searchOpen, setSearchOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [searchFilters, setSearchFilters] = useState({ ...DEFAULT_SEARCH_FILTERS })
    const [showSearchFilters, setShowSearchFilters] = useState(false)
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
    const [searchProperties, setSearchProperties] = useState([])
    const [searchLoaded, setSearchLoaded] = useState(false)
    const [searchLoading, setSearchLoading] = useState(false)
    const { user, handleLogout: logout } = useAuth()
    const navigate = useNavigate()
    const searchRef = useRef(null)
    const profileDropdownRef = useRef(null)
    const isAuthenticated = Boolean(user)
    const canUsePortal = mounted && typeof document !== 'undefined'
    const activeSearchFilters = useMemo(() => ({
        ...searchFilters,
        search: searchQuery,
    }), [searchFilters, searchQuery])
    const searchHref = useMemo(
        () => buildPropertySearchHref(activeSearchFilters),
        [activeSearchFilters]
    )

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        setIsAdmin(user?.is_admin === true || checkAdminInstant())
    }, [user])

    useEffect(() => {
        if (menubtn) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = 'auto'
        }
        return () => {
            document.body.style.overflow = 'auto'
        }
    }, [menubtn])

    // Close search when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setSearchOpen(false)
                setShowSearchFilters(false)
            }
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target)) {
                setShowProfileDropdown(false)
            }
        }
        document.addEventListener('mousedown', handleClickOutside)
        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [])

    useEffect(() => {
        if ((!searchOpen && !mobileSearchOpen) || searchLoaded || searchLoading) {
            return
        }

        let isMounted = true

        const loadSearchData = async () => {
            setSearchLoading(true)
            try {
                const properties = await getAllProperties()
                if (isMounted) {
                    setSearchProperties(properties)
                    setSearchLoaded(true)
                }
            } catch (error) {
                console.error('Error loading navbar search data:', error)
            } finally {
                if (isMounted) {
                    setSearchLoading(false)
                }
            }
        }

        loadSearchData()

        return () => {
            isMounted = false
        }
    }, [mobileSearchOpen, searchLoaded, searchLoading, searchOpen])

    // Filter properties based on search query
    const searchResults = useMemo(() => {
        if (!searchQuery.trim()) return []
        // Remove # symbol for search
        const cleanQuery = searchQuery.toLowerCase().replace('#', '').trim()

        return searchProperties.filter(item => {
            const propertyId = (item.property_id_number || '').toString().toLowerCase()
            const category = (item.category || '').toLowerCase()
            const propertyType = (item.property_type || '').toLowerCase()
            const area = (item.location?.area || '').toLowerCase()
            const district = (item.location?.state_district || '').toLowerCase()
            const subArea = (item.location?.sub_area || '').toLowerCase()
            const description = (item.location?.short_description || '').toLowerCase()
            const price = item.pricing?.rent_amount_bdt?.toString() || ''

            return (
                propertyId.includes(cleanQuery) ||
                category.includes(cleanQuery) ||
                propertyType.includes(cleanQuery) ||
                area.includes(cleanQuery) ||
                district.includes(cleanQuery) ||
                subArea.includes(cleanQuery) ||
                description.includes(cleanQuery) ||
                price.includes(cleanQuery)
            )
        }).slice(0, 5) // Limit to 5 results
    }, [searchProperties, searchQuery])

    const handleSearchSubmit = (event) => {
        event.preventDefault()
        navigate(searchHref)
        setSearchOpen(false)
        setShowSearchFilters(false)
        setMobileSearchOpen(false)
        setSearchQuery('')
        setSearchFilters({ ...DEFAULT_SEARCH_FILTERS })
        setmenubtn(false)
    }

    const handleSearchFilterChange = (field, value) => {
        setSearchFilters((current) => updateSearchFilters(current, field, value))
    }

    const resetSearchFilters = () => {
        setSearchQuery('')
        setSearchFilters({ ...DEFAULT_SEARCH_FILTERS })
    }

    const handleLogout = async () => {
        await logout()
        setIsAdmin(false)
        navigate('/login')
    }
    return (
        <div className='bg-white/95 text-gray-900 backdrop-blur-md shadow-sm sticky top-0 z-50 animate-fade-in-down'>
            <div className='mx-auto max-w-[1250px] px-3 md:px-6 xl:px-0'>
                {/* Top Row: Logo - Search - Profile/Logout - Login */}
                <div className='flex items-center justify-between gap-4 py-3'>
                    <Link to='/' className='hover-scale inline-block'>
                        <img
                            className='w-36 md:w-42 transition-transform duration-300'
                            src={LOGO_SRC}
                        alt='NewTolet.Com'
                            onError={(event) => {
                                event.currentTarget.src = LOGO_FALLBACK_SRC
                            }}
                        />
                    </Link>

                    <div className='hidden md:flex items-center gap-3 lg:gap-4 flex-shrink-0 ml-auto'>
                        <div className='hidden xl:flex items-center overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)]'>
                            <Link
                                to='/addproperty'
                                onClick={() => setMenu('addproperty')}
                                className={`flex items-center gap-2 px-5 py-3 text-[15px] font-semibold text-[#16395f] transition-colors duration-200 hover:bg-gray-50 ${menu === 'addproperty' ? 'bg-gray-50' : ''}`}
                            >
                                <BiPlus className='text-xl text-[#2b4a6f]' />
                                <span>Add Property</span>
                            </Link>
                            <span className='h-6 w-px bg-gray-200' />
                            <Link
                                to='/orderhome'
                                onClick={() => setMenu('orderhome')}
                                className={`flex items-center gap-2 px-5 py-3 text-[15px] font-semibold text-[#16395f] transition-colors duration-200 hover:bg-gray-50 ${menu === 'orderhome' ? 'bg-gray-50' : ''}`}
                            >
                                <BiHome className='text-lg text-[#2b4a6f]' />
                                <span>Order Home</span>
                            </Link>
                        </div>

                        {/* Search Bar */}
                        <div
                            className='hidden md:flex w-[280px] lg:w-[340px] xl:w-[400px] 2xl:w-[450px]'
                            ref={searchRef}
                        >
                            <div className='relative w-full'>
                            <form
                                onSubmit={handleSearchSubmit}
                                className={`flex items-center rounded-full border border-gray-200 bg-white shadow-[0_10px_28px_rgba(15,23,42,0.06)] transition-all duration-300 ${searchOpen ? 'border-[#1E73B8] ring-2 ring-[#1E73B8]/15' : 'hover:border-gray-300'}`}
                            >
                                <button
                                    type='submit'
                                    className='text-gray-500 ml-4 text-xl hover:text-[#1E73B8] transition-colors'
                                    aria-label='Search properties'
                                >
                                    <BiSearch />
                                </button>
                                <input
                                    type='text'
                                    placeholder='Search by area, road, property ID...'
                                    className='w-full bg-transparent py-3 pl-3 pr-2 outline-none text-sm text-gray-700 placeholder-gray-400'
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onFocus={() => setSearchOpen(true)}
                                />
                                <span className='h-6 w-px bg-gray-200' />
                                <button
                                    type='button'
                                    onClick={() => setShowSearchFilters((current) => !current)}
                                    className={`mx-2 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                                        showSearchFilters
                                            ? 'bg-[#1E73B8] text-white'
                                            : 'bg-[#1E73B8]/8 text-[#1E73B8] hover:bg-[#1E73B8]/12'
                                    }`}
                                >
                                    Filters
                                </button>
                                {searchQuery && (
                                    <button
                                        type='button'
                                        onClick={() => setSearchQuery('')}
                                        className='mr-4 text-gray-400 hover:text-gray-600 transition-colors'
                                    >
                                        <RxCross2 />
                                    </button>
                                )}
                            </form>

                            {showSearchFilters && (
                                <div className='absolute right-0 top-full mt-3 w-[min(92vw,720px)] rounded-[28px] border border-gray-100 bg-white p-4 shadow-2xl z-50'>
                                    <PropertySearchForm
                                        filters={activeSearchFilters}
                                        onFieldChange={handleSearchFilterChange}
                                        onSubmit={handleSearchSubmit}
                                        onReset={resetSearchFilters}
                                        showSort={false}
                                        submitLabel='Search'
                                        resetLabel='Reset'
                                        compact
                                    />
                                </div>
                            )}

                            {/* Search Results Dropdown */}
                            {searchOpen && !showSearchFilters && searchResults.length > 0 && (
                                <div className='absolute right-0 top-full mt-3 w-full bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-40 animate-fade-in-down'>
                                    {searchResults.map((item) => (
                                        <Link
                                            key={item.id}
                                            to={buildListDetailsHref(item.id)}
                                            onClick={() => {
                                                setSearchOpen(false);
                                                setShowSearchFilters(false);
                                                resetSearchFilters();
                                            }}
                                            className='flex items-center gap-3 px-4 py-3 hover:bg-[#1E73B8]/10 transition-all duration-200 border-b border-gray-50 last:border-0'
                                        >
                                            <div className='w-12 h-12 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0'>
                                                {item.images && item.images.length > 0 ? (
                                                    <img
                                                        src={item.images[0]}
                                                        alt={item.category}
                                                        className='w-full h-full object-cover'
                                                    />
                                                ) : (
                                                    <div className='w-full h-full flex items-center justify-center text-gray-400'>
                                                        <BiHome />
                                                    </div>
                                                )}
                                            </div>
                                            <div className='flex-1 min-w-0'>
                                                <div className='flex items-center gap-2'>
                                                    <span className='text-xs font-bold text-[#1E73B8]'>#{item.property_id_number || ''}</span>
                                                    <p className='font-medium text-gray-800 truncate'>{item.category || 'Property'}</p>
                                                </div>
                                                <p className='text-sm text-gray-500 truncate'>{item.location?.area || ''}, {item.location?.state_district || ''}</p>
                                            </div>
                                            <div className='text-right flex-shrink-0'>
                                                <p className='font-bold text-[#1E73B8]'>৳{item.pricing?.rent_amount_bdt || 0}</p>
                                            </div>
                                        </Link>
                                    ))}
                                    <Link
                                        to={searchHref}
                                        onClick={() => {
                                            setSearchOpen(false);
                                            setShowSearchFilters(false);
                                            resetSearchFilters();
                                        }}
                                        className='block text-center py-2.5 text-sm text-[#1E73B8] font-medium hover:bg-[#1E73B8]/10 transition-colors'
                                    >
                                        View all results
                                    </Link>
                                </div>
                            )}

                            {/* No Results */}
                            {searchOpen && !showSearchFilters && searchQuery && searchResults.length === 0 && (
                                <div className='absolute right-0 top-full mt-3 w-full bg-white rounded-xl shadow-xl border border-gray-100 p-4 text-center z-40'>
                                    <p className='text-gray-500'>No properties found</p>
                                </div>
                            )}
                        </div>
                        </div>

                        {/* Profile, Logout, Login - Desktop */}
                        <div className='hidden md:flex items-center gap-3 lg:gap-4 flex-shrink-0'>
                        {isAuthenticated ? (
                            <>
                                {/* Profile Dropdown */}
                                <div className='relative' ref={profileDropdownRef}>
                                    <button
                                        onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                                        className={`flex items-center gap-2 text-zinc-600 font-medium hover:text-[#1E73B8] transition-all duration-300 ${showProfileDropdown ? "text-[#1E73B8]" : ''}`}
                                    >
                                        <div className='w-10 h-10 rounded-full bg-[#1E73B8] flex items-center justify-center text-white hover:bg-[#1665a0] hover:scale-110 transition-all duration-300'>
                                            <CgProfile className='text-xl' />
                                        </div>
                                    </button>

                                    {/* Profile Dropdown Menu */}
                                    {showProfileDropdown && (
                                        <div className='absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 transition-all duration-300 animate-fade-in-down'>
                                        <Link
                                            to='/dashboard'
                                            onClick={() => { setMenu("profile"); setShowProfileDropdown(false); }}
                                            className='flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8] transition-all duration-200'
                                        >
                                            <CgProfile className='text-xl' />
                                            <span className='font-medium'>Profile</span>
                                        </Link>
                                        <Link
                                            to='/book/buy-credits'
                                            onClick={() => { setShowProfileDropdown(false); }}
                                            className='flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8] transition-all duration-200'
                                        >
                                            <BiCoin className='text-xl' />
                                            <span className='font-medium'>Buy Credits</span>
                                        </Link>
                                        {isAdmin && (
                                            <Link
                                                to='/admin'
                                                onClick={() => { setShowProfileDropdown(false); }}
                                                className='flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8] transition-all duration-200'
                                            >
                                                <MdDashboard className='text-xl' />
                                                <span className='font-medium'>Admin Panel</span>
                                            </Link>
                                        )}
                                        </div>
                                    )}
                                </div>

                                {/* Logout Button */}
                                <button
                                    onClick={handleLogout}
                                    className='text-3xl text-red-500 cursor-pointer rounded hover:text-red-600 hover:scale-110 transition-all duration-300'
                                    title="Logout"
                                >
                                    <TbLogout />
                                </button>
                            </>
                        ) : (
                            <Link to='/login'>
                                <button className='flex items-center gap-2 bg-[#1E73B8] hover:bg-[#1665a0] py-2.5 px-6 rounded-lg text-white transition-all duration-300 hover:shadow-lg hover:scale-105'>
                                    <CgProfile className='text-lg' />
                                    Login
                                </button>
                            </Link>
                        )}
                    </div>
                    </div>

                    {/* Mobile Search & Menu Buttons */}
                    <div className='md:hidden flex items-center gap-1'>
                        {/* Search Icon Button */}
                        <button
                            onClick={() => setMobileSearchOpen(true)}
                            className={`p-2 rounded-full transition-all duration-300 ${mobileSearchOpen ? 'text-[#1E73B8] bg-blue-50' : 'text-zinc-700 hover:bg-gray-100'}`}
                        >
                            <BiSearch className='text-xl' />
                        </button>
                        {/* Menu Button */}
                        <span onClick={() => setmenubtn(true)} className='text-2xl text-zinc-700 cursor-pointer hover:text-[#1E73B8] transition-colors duration-300 p-2'><TfiMenu /></span>
                    </div>
                </div>

                {/* Horizontal Line */}
                <hr className='border-gray-200' />

                {/* Bottom Row: Navigation Menu */}
                <div className='hidden md:flex justify-center items-center py-2'>
                    <ul className='flex justify-center items-center gap-8'>
                        <li onClick={() => setMenu("home")} className={`${menu === "home" ? "border-b-2 border-[#1E73B8] pb-1" : ''} text-base text-zinc-600 font-medium hover:text-[#1E73B8] transition-all duration-300 cursor-pointer`}>
                            <Link to='/' className='flex items-center gap-1.5'>
                                <BiHome className='text-lg' />
                                Home
                            </Link>
                        </li>

                        {/* Property Dropdown Menu */}
                        <li
                            className='relative'
                            onMouseEnter={() => setShowPropertyDropdown(true)}
                            onMouseLeave={() => setShowPropertyDropdown(false)}
                        >
                            <button
                                onClick={() => setShowPropertyDropdown(!showPropertyDropdown)}
                                className={`${menu === "propertylist" || menu === "addproperty" ? "border-b-2 border-[#1E73B8] pb-1" : ''} text-base text-zinc-600 font-medium hover:text-[#1E73B8] transition-all duration-300 cursor-pointer flex items-center gap-1`}
                            >
                                <BiBuildings className='text-lg' />
                                Properties
                                {showPropertyDropdown ? <FiChevronUp className='text-xs' /> : <FiChevronDown className='text-xs' />}
                            </button>

                            {/* Dropdown Menu */}
                            <div className={`absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-2 transition-all duration-300 ${showPropertyDropdown ? 'opacity-100 visible translate-y-0' : 'opacity-0 invisible -translate-y-2'}`}>
                                <Link
                                    to='/propertylist2'
                                    onClick={() => { setMenu("propertylist"); setShowPropertyDropdown(false); }}
                                    className='flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8] transition-all duration-200 text-sm'
                                >
                                    <BiBuildings className='text-lg' />
                                    <span className='font-medium'>Property List</span>
                                </Link>
                                <Link
                                    to='/addproperty'
                                    onClick={() => { setMenu("addproperty"); setShowPropertyDropdown(false); }}
                                    className='flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8] transition-all duration-200 text-sm'
                                >
                                    <BiPlus className='text-lg' />
                                    <span className='font-medium'>Add Property</span>
                                </Link>
                                {user && (
                                    <Link
                                        to='/my-properties'
                                        onClick={() => { setMenu("myproperties"); setShowPropertyDropdown(false); }}
                                        className='flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8] transition-all duration-200 text-sm'
                                    >
                                        <BiHome className='text-lg' />
                                        <span className='font-medium'>My Properties</span>
                                    </Link>
                                )}
                            </div>
                        </li>

                        {/* My Orders - Only for logged in users */}
                        {isAuthenticated && (
                            <li onClick={() => setMenu("orders")} className={`${menu === "orders" ? "border-b-2 border-[#1E73B8] pb-1" : ''} text-base text-zinc-600 font-medium hover:text-[#1E73B8] transition-all duration-300 cursor-pointer`}>
                                <Link to='/my-orders' className='flex items-center gap-1.5'>
                                    <HiOutlineClipboardList className='text-lg' />
                                    Order Home
                                </Link>
                            </li>
                        )}

                        {/* Earn Money */}
                        <li onClick={() => setMenu("earnmoney")} className={`${menu === "earnmoney" ? "border-b-2 border-[#1E73B8] pb-1" : ''} text-base text-zinc-600 font-medium hover:text-[#1E73B8] transition-all duration-300 cursor-pointer`}>
                            <Link to='/earnmoney' className='flex items-center gap-1.5'>
                                <BiDollarCircle className='text-lg' />
                                Earn Money
                            </Link>
                        </li>
                    </ul>
                </div>
            </div>

            {/* Mobile Menu - Rendered via Portal to escape stacking context */}
            {canUsePortal && menubtn && ReactDOM.createPortal(
                <>
                    {/* Mobile Menu Overlay */}
                    <div
                        className='md:hidden fixed inset-0 bg-black/75 transition-opacity duration-500 opacity-100 visible'
                        style={{ zIndex: 9998 }}
                        onClick={() => setmenubtn(false)}
                    />

                    {/* Mobile Sidebar */}
                    <div
                        className='md:hidden fixed top-0 right-0 h-full w-[300px] bg-white text-gray-900 shadow-2xl transform transition-transform duration-500 ease-out border-l border-gray-200 translate-x-0'
                        style={{ zIndex: 9999 }}
                    >
                        <div className='p-6 h-full overflow-y-auto'>
                            <div className='flex items-center justify-between mb-8 border-b border-gray-200 pb-5'>
                                <Link to='/' onClick={() => setmenubtn(false)} className='inline-flex items-center'>
                                    <img
                                        className='h-10 w-auto'
                                        src={LOGO_SRC}
                                    alt='NewTolet.Com'
                                        onError={(event) => {
                                            event.currentTarget.src = LOGO_FALLBACK_SRC
                                        }}
                                    />
                                </Link>
                                <span onClick={() => setmenubtn(false)} className='text-3xl cursor-pointer p-2 hover:bg-gray-100 rounded-full transition-colors duration-300 text-gray-700'><RxCross2 /></span>
                            </div>

                            <div className='flex flex-col items-center'>
                                <ul className='flex flex-col w-full gap-2'>
                                    <li className='text-lg cursor-pointer px-4 py-3 rounded-lg text-gray-700 font-medium hover:bg-[#1E73B8]/10 hover:text-[#1E73B8] transition-all duration-300'>
                                        <Link to='/' className='block w-full' onClick={() => setmenubtn(false)}>Home</Link>
                                    </li>

                                    {/* Mobile Properties Dropdown */}
                                    <li className='text-lg cursor-pointer rounded-lg text-gray-700 font-medium'>
                                        <button
                                            onClick={() => setMobilePropertyDropdown(!mobilePropertyDropdown)}
                                            className='flex items-center justify-between w-full px-4 py-3 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8] transition-all duration-300 rounded-lg'
                                        >
                                            <span>Properties</span>
                                            {mobilePropertyDropdown ? <FiChevronUp /> : <FiChevronDown />}
                                        </button>
                                        <div className={`overflow-hidden transition-all duration-300 ${mobilePropertyDropdown ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
                                            <Link
                                                to='/propertylist2'
                                                className='flex items-center gap-3 pl-8 pr-4 py-2 text-gray-600 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8] transition-all duration-200'
                                                onClick={() => setmenubtn(false)}
                                            >
                                                <BiBuildings />
                                                Property List
                                            </Link>
                                            <Link
                                                to='/addproperty'
                                                className='flex items-center gap-3 pl-8 pr-4 py-2 text-gray-600 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8] transition-all duration-200'
                                                onClick={() => setmenubtn(false)}
                                            >
                                                <BiPlus />
                                                Add Property
                                            </Link>
                                            {isAuthenticated && (
                                                <Link
                                                    to='/my-properties'
                                                    className='flex items-center gap-3 pl-8 pr-4 py-2 text-gray-600 hover:bg-[#1E73B8]/10 hover:text-[#1E73B8] transition-all duration-200'
                                                    onClick={() => setmenubtn(false)}
                                                >
                                                    <BiHome />
                                                    My Properties
                                                </Link>
                                            )}
                                        </div>
                                    </li>

                                    {/* My Orders - Mobile */}
                                    {isAuthenticated && (
                                        <li className='text-lg cursor-pointer px-4 py-3 rounded-lg text-gray-700 font-medium hover:bg-[#1E73B8]/10 hover:text-[#1E73B8] transition-all duration-300'>
                                            <Link to='/my-orders' className='flex items-center gap-3 w-full' onClick={() => setmenubtn(false)}>
                                                <HiOutlineClipboardList />
                                                Order Home
                                            </Link>
                                        </li>
                                    )}

                                    {/* Earn Money - Mobile */}
                                    <li className='text-lg cursor-pointer px-4 py-3 rounded-lg text-gray-700 font-medium hover:bg-[#1E73B8]/10 hover:text-[#1E73B8] transition-all duration-300'>
                                        <Link to='/earnmoney' className='flex items-center gap-3 w-full' onClick={() => setmenubtn(false)}>
                                            <BiDollarCircle />
                                            Earn Money
                                        </Link>
                                    </li>

                                    {isAuthenticated ? (
                                        <>
                                            <li className='text-lg cursor-pointer px-4 py-3 rounded-lg text-gray-700 font-medium hover:bg-[#1E73B8]/10 hover:text-[#1E73B8] transition-all duration-300'>
                                                <Link to='/book/buy-credits' className='flex items-center gap-3 w-full' onClick={() => setmenubtn(false)}>
                                                    <BiCoin />
                                                    Buy Credits
                                                </Link>
                                            </li>
                                            <li className='text-lg cursor-pointer px-4 py-3 rounded-lg text-gray-700 font-medium hover:bg-[#1E73B8]/10 hover:text-[#1E73B8] transition-all duration-300'>
                                                <Link to='/dashboard' className='block w-full' onClick={() => setmenubtn(false)}>Profile</Link>
                                            </li>
                                            {isAdmin && (
                                                <li className='text-lg cursor-pointer px-4 py-3 rounded-lg text-gray-700 font-medium hover:bg-[#1E73B8]/10 hover:text-[#1E73B8] transition-all duration-300'>
                                                    <Link to='/admin' className='block w-full' onClick={() => setmenubtn(false)}>Admin Panel</Link>
                                                </li>
                                            )}
                                            <button
                                                onClick={() => {
                                                    handleLogout()
                                                    setmenubtn(false)
                                                }}
                                                className='bg-red-500 hover:bg-red-600 py-3 px-7 rounded-lg text-white mt-4 w-full transition-all duration-300 hover:shadow-lg'
                                            >
                                                Logout
                                            </button>
                                        </>
                                    ) : (
                                        <li className='mt-4'>
                                            <Link to='/login' className='block w-full' onClick={() => setmenubtn(false)}>
                                                <button className='bg-[#1E73B8] text-white hover:bg-[#1665a0] py-3 px-7 rounded-lg w-full transition-all duration-300 hover:shadow-lg font-semibold'>
                                                    Login
                                                </button>
                                            </Link>
                                        </li>
                                    )}
                                </ul>
                            </div>
                        </div>
                    </div>
                </>,
                document.body
            )}

            {/* Mobile Search Results Outlet - Appears outside sidebar */}
            {canUsePortal && mobileSearchOpen && ReactDOM.createPortal(
                <div className='md:hidden fixed inset-0 z-[10000]'>
                    {/* Overlay Background */}
                    <div
                        className='absolute inset-0 bg-black/50'
                        onClick={() => setMobileSearchOpen(false)}
                    />

                    {/* Search Container */}
                    <div className='absolute top-0 left-0 right-0 bg-white shadow-2xl animate-fade-in-down'>
                        {/* Search Bar */}
                        <form onSubmit={handleSearchSubmit} className='flex items-center gap-3 px-4 py-3 border-b border-gray-100'>
                            <button
                                type='submit'
                                className='text-gray-500 hover:text-gray-700 transition-colors'
                                aria-label='Search properties'
                            >
                                <BiSearch className='text-xl' />
                            </button>
                            <input
                                type='text'
                                placeholder='Search by area, road, property ID...'
                                className='flex-1 bg-transparent py-2 outline-none text-gray-700 placeholder-gray-400 text-base'
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                autoFocus
                            />
                            {searchQuery && (
                                <button
                                    type='button'
                                    onClick={() => setSearchQuery('')}
                                    className='text-gray-400 hover:text-gray-600 transition-colors'
                                >
                                    <RxCross2 className='text-xl' />
                                </button>
                            )}
                            <button
                                type='button'
                                onClick={() => { setMobileSearchOpen(false); setSearchQuery(''); }}
                                className='text-[#1E73B8] font-medium text-base'
                            >
                                Cancel
                            </button>
                        </form>

                        <div className='border-b border-gray-100 px-4 py-4'>
                            <PropertySearchForm
                                filters={activeSearchFilters}
                                onFieldChange={handleSearchFilterChange}
                                onSubmit={handleSearchSubmit}
                                onReset={resetSearchFilters}
                                showSort={false}
                                submitLabel='Search'
                                resetLabel='Reset'
                                compact
                            />
                        </div>

                        {/* Results List */}
                        <div className='overflow-y-auto' style={{ maxHeight: '70vh' }}>
                            {searchQuery && searchResults.length > 0 ? (
                                <div className='p-3 space-y-2'>
                                    {searchResults.map((item) => (
                                        <Link
                                            key={item.id}
                                            to={buildListDetailsHref(item.id)}
                                            onClick={() => {
                                                setmenubtn(false);
                                                setMobileSearchOpen(false);
                                                resetSearchFilters();
                                            }}
                                            className='flex items-center gap-3 p-3 bg-gray-50 rounded-xl hover:bg-[#1E73B8]/10 transition-all duration-200 border border-gray-100'
                                        >
                                            <div className='w-14 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-200'>
                                                {item.images && item.images.length > 0 ? (
                                                    <img src={item.images[0]} alt={item.category} className='w-full h-full object-cover' />
                                                ) : (
                                                    <div className='w-full h-full flex items-center justify-center text-gray-400'>
                                                        <BiHome className='text-xl' />
                                                    </div>
                                                )}
                                            </div>
                                            <div className='flex-1 min-w-0'>
                                                <div className='flex items-center gap-2 mb-1'>
                                                    <span className='text-xs font-bold text-[#1E73B8]'>#{item.property_id_number || ''}</span>
                                                    <p className='font-medium text-gray-800 truncate text-sm'>{item.category || 'Property'}</p>
                                                </div>
                                                <p className='text-xs text-gray-500 truncate'>{item.location?.area || ''}, {item.location?.state_district || ''}</p>
                                                <p className='text-sm font-bold text-[#1E73B8] mt-1'>৳{item.pricing?.rent_amount_bdt || 0}</p>
                                            </div>
                                        </Link>
                                    ))}
                                    <Link
                                        to={searchHref}
                                        onClick={() => {
                                            setmenubtn(false);
                                            setMobileSearchOpen(false);
                                            resetSearchFilters();
                                        }}
                                        className='block w-full py-2.5 text-center bg-[#1E73B8] text-white rounded-xl font-medium hover:bg-[#1665a0] transition-colors'
                                    >
                                        View All Results
                                    </Link>
                                </div>
                            ) : searchQuery && searchLoading ? (
                                <div className='py-16 text-center'>
                                    <BiSearch className='text-4xl text-gray-300 mx-auto mb-3 animate-pulse' />
                                    <p className='text-gray-500'>Loading properties...</p>
                                </div>
                            ) : searchQuery ? (
                                <div className='py-16 text-center'>
                                    <BiSearch className='text-4xl text-gray-300 mx-auto mb-3' />
                                    <p className='text-gray-500'>No properties found</p>
                                    <p className='text-sm text-gray-400 mt-1'>Try a different search term</p>
                                </div>
                            ) : (
                                <div className='py-16 text-center'>
                                    <BiSearch className='text-4xl text-gray-300 mx-auto mb-3' />
                                    <p className='text-gray-500'>Search for properties</p>
                                    <p className='text-sm text-gray-400 mt-1'>Enter property ID, location or category</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Navber;
