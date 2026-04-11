import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BiHome, BiImage, BiUser, BiPackage, BiCreditCard, BiEnvelope } from 'react-icons/bi';
import { MdDelete, MdEdit, MdAdd, MdDashboard, MdFeedback, MdSettings, MdCheckCircle, MdCancel, MdBlock, MdAttachMoney } from 'react-icons/md';
import { RxCross2 } from 'react-icons/rx';
import { TfiMenu } from 'react-icons/tfi';
import { FaSave, FaEye, FaEyeSlash, FaStar, FaRegStar, FaUserShield } from 'react-icons/fa';
import { FiUpload, FiLink, FiImage as FiImageIcon } from 'react-icons/fi';
import { GiHouse } from 'react-icons/gi';
import { getStoredUser } from '../../services/authService';
import PropertyMap from '../../components/Admin/PropertyMap';
import SearchHistoryManagement from '../Admin/SearchHistoryManagement';
import {
    getCoverPhotos,
    addCoverPhoto,
    updateCoverPhoto,
    deleteCoverPhoto,
    toggleCoverPhotoStatus,
    uploadCoverImageToSupabase
} from '../../services/coverPhotoService';
import {
    getAllUsers,
    updateUserStatus,
    deleteUser,
    updateUserRole,
    getAllProperties,
    updatePropertyStatus,
    deleteProperty,
    togglePropertyFeatured,
    getAllFeedback,
    deleteFeedback,
    updateFeedbackStatus,
    approveFeedback,
    rejectFeedback,
    getAllOrders,
    updateOrderStatus,
    updateOrderJobFeed,
    deleteOrder,
    getAllPropertyInquiries,
    updateInquiryStatus,
    deleteInquiry,
    getDashboardStats,
    getDailyListingReport,
    getCreditPackages,
    saveCreditPackages,
    addCreditPackage,
    updateCreditPackage,
    deleteCreditPackage,
    togglePackageStatus,
    getCreditCosts,
    saveCreditCosts,
    getSiteTheme,
    saveSiteTheme,
    updateUserCredits,
    getAllUsersWithCredits,
    updateUserEmployeeStatus
} from '../../services/adminService';
import { supabase } from '../../services/supabaseClient';
import {
    formatOrderNeedFrom,
    formatOrderPreferencesSummary,
} from '../../utils/orderPreferences';

const LOGO_SRC = '/logo.png';
const LOGO_FALLBACK_SRC = '/logo1.png';
const SITE_THEME_EVENT = 'site-theme-updated';

const formatOrderJobFeedLocation = (order) =>
    [order?.sub_area, order?.area, order?.district, order?.division]
        .filter(Boolean)
        .join(', ');

const buildOrderJobFeedFallbackTitle = (order) => {
    const category = order?.category || 'Home';
    const location = formatOrderJobFeedLocation(order);
    return location ? `${category} needed in ${location}` : `${category} requirement posted`;
};

const buildOrderJobFeedFallbackDescription = (order) => {
    const summary = formatOrderPreferencesSummary(order?.additional_preferences);

    if (summary) {
        return summary;
    }

    const parts = [];

    if (order?.rooms) {
        parts.push(`${order.rooms} room requirement`);
    }

    if (order?.max_budget) {
        parts.push(`Budget up to BDT ${Number(order.max_budget).toLocaleString()}`);
    }

    if (order?.property_need_from) {
        parts.push(`Need from ${formatOrderNeedFrom(order.property_need_from)}`);
    }

    return parts.join(' | ') || 'No public description added yet.';
};

const canOrderBePostedToJobFeed = (order) => order?.status === 'confirmed';

const Admin = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const initialTab = searchParams.get('tab') || 'dashboard';
    const [activeMenu, setActiveMenu] = useState(initialTab);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Update URL when tab changes
    const handleMenuChange = (menuId) => {
        setActiveMenu(menuId);
        setSearchParams({ tab: menuId });
    };
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ type: '', text: '' });
    const [currentUser, setCurrentUser] = useState(null);

    // Dashboard stats
    const [stats, setStats] = useState({
        totalUsers: 0,
        activeUsers: 0,
        totalProperties: 0,
        pendingProperties: 0,
        totalOrders: 0,
        totalFeedback: 0
    });
    const [listingReport, setListingReport] = useState({
        days: 7,
        dailyCounts: [],
        totalNewListings: 0,
        todaysNewListings: 0
    });

    // Cover Photos
    const [coverPhotos, setCoverPhotos] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [newPhotoUrl, setNewPhotoUrl] = useState('');
    const [editingPhoto, setEditingPhoto] = useState(null);
    const [uploadMode, setUploadMode] = useState('file'); // 'file' or 'url'
    const [selectedFile, setSelectedFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef(null);

    // Users
    const [users, setUsers] = useState([]);

    // Properties
    const [properties, setProperties] = useState([]);
    const [propertyFilter, setPropertyFilter] = useState('all');
    const [autoApproveEnabled, setAutoApproveEnabled] = useState(false);

    // Feedback
    const [feedbacks, setFeedbacks] = useState([]);

    // Orders
    const [orders, setOrders] = useState([]);

    // Inquiries
    const [inquiries, setInquiries] = useState([]);

    // Credit Packages & Pricing
    const [creditPackages, setCreditPackagesState] = useState([]);
    const [creditCosts, setCreditCosts] = useState({});
    const [siteTheme, setSiteTheme] = useState('light');
    const [savingSiteTheme, setSavingSiteTheme] = useState(false);
    const [showAddPackageModal, setShowAddPackageModal] = useState(false);
    const [showEditPackageModal, setShowEditPackageModal] = useState(false);
    const [editingPackage, setEditingPackage] = useState(null);
    const [newPackage, setNewPackage] = useState({
        name: '',
        credits: 100,
        price: 500,
        discount: 0,
        popular: false
    });
    const [usersWithCredits, setUsersWithCredits] = useState([]);
    const [showCreditModal, setShowCreditModal] = useState(false);
    const [selectedUserForCredit, setSelectedUserForCredit] = useState(null);
    const [creditAmount, setCreditAmount] = useState(0);
    const [creditAction, setCreditAction] = useState('add');

    // Property detail modal
    const [selectedPropertyDetail, setSelectedPropertyDetail] = useState(null);
    const [showJobFeedModal, setShowJobFeedModal] = useState(false);
    const [editingJobFeedOrder, setEditingJobFeedOrder] = useState(null);
    const [jobFeedDraft, setJobFeedDraft] = useState({
        title: '',
        description: '',
        isPosted: false
    });
    const [jobFeedSaving, setJobFeedSaving] = useState(false);

    // Search state
    const [searchQuery, setSearchQuery] = useState('');

    const menuItems = [
        { id: 'dashboard', label: 'Dashboard', icon: <MdDashboard className='text-xl' /> },
        { id: 'pricing', label: 'Pricing & Credits', icon: <MdAttachMoney className='text-xl' /> },
        { id: 'cover-photos', label: 'Cover Photos', icon: <BiImage className='text-xl' /> },
        { id: 'users', label: 'Users', icon: <BiUser className='text-xl' /> },
        { id: 'properties', label: 'Properties', icon: <GiHouse className='text-xl' /> },
        { id: 'orders', label: 'Orders', icon: <BiPackage className='text-xl' /> },
        { id: 'inquiries', label: 'Inquiries', icon: <BiEnvelope className='text-xl' /> },
        { id: 'search-history', label: 'Search History', icon: <FiLink className='text-xl' /> },
        { id: 'feedback', label: 'Feedback', icon: <MdFeedback className='text-xl' /> }
    ];

    useEffect(() => {
        // Admin access is already verified by AdminRoute wrapper
        // Just load the current user and dashboard data
        const user = getStoredUser();
        if (user) {
            setCurrentUser(user);
        }
        loadDashboardData();
    }, []);

    useEffect(() => {
        // Clear search query when switching tabs
        setSearchQuery('');
        switch (activeMenu) {
            case 'dashboard':
                loadDashboardStats();
                break;
            case 'pricing':
                loadPricingData();
                break;
            case 'cover-photos':
                fetchCoverPhotos();
                break;
            case 'users':
                fetchUsers();
                break;
            case 'properties':
                fetchProperties();
                fetchAutoApproveSetting();
                break;
            case 'feedback':
                fetchFeedback();
                break;
            case 'orders':
                fetchOrders();
                break;
            case 'inquiries':
                fetchInquiries();
                break;
            case 'search-history':
                break;
            default:
                break;
        }
    }, [activeMenu]);

    const loadDashboardData = async () => {
        await loadDashboardStats();
    };

    const loadDashboardStats = async () => {
        setLoading(true);
        const [{ data, error }, { data: reportData, error: reportError }] = await Promise.all([
            getDashboardStats(),
            getDailyListingReport(7)
        ]);

        if (!error && data) {
            setStats(data);
        }

        if (!reportError && reportData) {
            setListingReport(reportData);
        }
        setLoading(false);
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    };

    // ==================== COVER PHOTOS ====================
    const fetchCoverPhotos = async () => {
        setLoading(true);
        const { data, error } = await getCoverPhotos();
        if (error) {
            showMessage('error', 'Failed to load cover photos');
        } else {
            setCoverPhotos(data || []);
        }
        setLoading(false);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                showMessage('error', 'Please select an image file');
                return;
            }
            // Note: File size validation removed - optimization will handle large files
            setSelectedFile(file);
            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setFilePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const resetUploadForm = () => {
        setNewPhotoUrl('');
        setSelectedFile(null);
        setFilePreview(null);
        setShowAddModal(false);
        setUploadMode('file');
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleAddPhoto = async () => {
        // Validate based on upload mode
        if (uploadMode === 'url') {
            if (!newPhotoUrl.trim()) {
                showMessage('error', 'Please enter a valid image URL');
                return;
            }
        } else {
            if (!selectedFile) {
                showMessage('error', 'Please select an image file');
                return;
            }
        }

        setUploading(true);
        let imageUrl = newPhotoUrl;

        // If file upload mode, upload to Supabase first
        if (uploadMode === 'file' && selectedFile) {
            const uploadResult = await uploadCoverImageToSupabase(selectedFile);
            if (uploadResult.error) {
                showMessage('error', `Upload failed: ${uploadResult.error.message || 'Unknown error'}`);
                setUploading(false);
                return;
            }
            imageUrl = uploadResult.data.url;
        }

        const nextOrder = coverPhotos.length > 0
            ? Math.max(...coverPhotos.map(p => p.order_index)) + 1
            : 1;

        const { error } = await addCoverPhoto(imageUrl, nextOrder);

        if (error) {
            showMessage('error', 'Failed to add cover photo');
        } else {
            showMessage('success', 'Cover photo added successfully');
            resetUploadForm();
            fetchCoverPhotos();
        }
        setUploading(false);
    };

    const handleUpdatePhoto = async () => {
        if (!editingPhoto || !editingPhoto.image_url.trim()) {
            showMessage('error', 'Please enter a valid image URL');
            return;
        }

        const { error } = await updateCoverPhoto(editingPhoto.id, editingPhoto.image_url);

        if (error) {
            showMessage('error', 'Failed to update cover photo');
        } else {
            showMessage('success', 'Cover photo updated successfully');
            setShowEditModal(false);
            setEditingPhoto(null);
            fetchCoverPhotos();
        }
    };

    const handleDeletePhoto = async (id) => {
        if (!window.confirm('Are you sure you want to delete this cover photo?')) {
            return;
        }

        const { error } = await deleteCoverPhoto(id);

        if (error) {
            showMessage('error', 'Failed to delete cover photo');
        } else {
            showMessage('success', 'Cover photo deleted successfully');
            fetchCoverPhotos();
        }
    };

    const handleTogglePhotoStatus = async (id, currentStatus) => {
        const { error } = await toggleCoverPhotoStatus(id, !currentStatus);

        if (error) {
            showMessage('error', 'Failed to update status');
        } else {
            showMessage('success', 'Status updated successfully');
            fetchCoverPhotos();
        }
    };

    // ==================== USERS ====================
    const fetchUsers = async () => {
        setLoading(true);
        const { data, error } = await getAllUsers();
        if (error) {
            showMessage('error', 'Failed to load users');
            setUsers([]);
        } else {
            setUsers(data || []);
        }
        setLoading(false);
    };

    const handleToggleUserStatus = async (userId, currentStatus) => {
        const { error } = await updateUserStatus(userId, !currentStatus);

        if (error) {
            showMessage('error', 'Failed to update user status');
        } else {
            showMessage('success', 'User status updated successfully');
            fetchUsers();
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user?')) {
            return;
        }

        const { error } = await deleteUser(userId);

        if (error) {
            showMessage('error', 'Failed to delete user');
        } else {
            showMessage('success', 'User deleted successfully');
            fetchUsers();
        }
    };

    const handleToggleAdminRole = async (userId, currentRole) => {
        const { error } = await updateUserRole(userId, !currentRole);

        if (error) {
            showMessage('error', 'Failed to update user role');
        } else {
            showMessage('success', 'User role updated successfully');
            fetchUsers();
        }
    };

    const handleToggleEmployeeRole = async (userId, currentRole) => {
        const { error } = await updateUserEmployeeStatus(userId, !currentRole);

        if (error) {
            showMessage('error', 'Failed to update employee status');
        } else {
            showMessage('success', !currentRole ? 'User marked as employee' : 'Employee tag removed');
            fetchUsers();
        }
    };

    const getUserRoleLabel = (user) => {
        if (user.is_admin) {
            return 'Admin';
        }

        if (user.is_employee) {
            return 'Employee';
        }

        return 'User';
    };

    const getUserRoleClasses = (user) => {
        if (user.is_admin) {
            return 'bg-purple-100 text-purple-800';
        }

        if (user.is_employee) {
            return 'bg-sky-100 text-sky-800';
        }

        return 'bg-gray-100 text-gray-800';
    };

    // ==================== PROPERTIES ====================
    const fetchProperties = async () => {
        setLoading(true);
        const { data, error } = await getAllProperties();
        if (error) {
            showMessage('error', 'Failed to load properties');
            setProperties([]);
        } else {
            setProperties(data || []);
        }
        setLoading(false);
    };

    const fetchAutoApproveSetting = async () => {
        try {
            const { data, error } = await supabase
                .from('site_settings')
                .select('auto_approve_properties')
                .single();

            if (!error && data) {
                setAutoApproveEnabled(data.auto_approve_properties || false);
            } else {
                const stored = localStorage.getItem('autoApproveProperties');
                setAutoApproveEnabled(stored === 'true');
            }
        } catch (e) {
            const stored = localStorage.getItem('autoApproveProperties');
            setAutoApproveEnabled(stored === 'true');
        }
    };

    const handleToggleAutoApprove = async () => {
        const newValue = !autoApproveEnabled;
        setAutoApproveEnabled(newValue);

        try {
            const { error } = await supabase
                .from('site_settings')
                .upsert({ auto_approve_properties: newValue });

            if (error) {
                console.error('Error saving to database, using localStorage:', error);
                localStorage.setItem('autoApproveProperties', String(newValue));
            }
        } catch (e) {
            localStorage.setItem('autoApproveProperties', String(newValue));
        }

        showMessage('success', newValue ? 'Auto-approve enabled' : 'Auto-approve disabled');
    };

    const handlePropertyStatusChange = async (propertyId, status) => {
        const { error } = await updatePropertyStatus(propertyId, status);

        if (error) {
            showMessage('error', 'Failed to update property status');
        } else {
            showMessage('success', `Property ${status} successfully`);
            fetchProperties();
        }
    };

    const handleDeleteProperty = async (propertyId) => {
        if (!window.confirm('Are you sure you want to delete this property?')) {
            return;
        }

        const { error } = await deleteProperty(propertyId);

        if (error) {
            showMessage('error', 'Failed to delete property');
        } else {
            showMessage('success', 'Property deleted successfully');
            fetchProperties();
        }
    };

    const handleToggleFeatured = async (propertyId, currentStatus) => {
        const { error } = await togglePropertyFeatured(propertyId, !currentStatus);

        if (error) {
            showMessage('error', 'Failed to update featured status');
        } else {
            showMessage('success', 'Featured status updated successfully');
            fetchProperties();
        }
    };

    const filteredProperties = properties.filter(prop => {
        const statusMatch = propertyFilter === 'all' || prop.status === propertyFilter;
        const searchMatch = !searchQuery ||
            prop.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            prop.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            prop.area?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            prop.state_district?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            prop.id?.toString().includes(searchQuery);
        return statusMatch && searchMatch;
    });

    // ==================== FEEDBACK ====================
    const fetchFeedback = async () => {
        setLoading(true);

        const { data, error } = await getAllFeedback();

        if (error) {
            const localFeedback = JSON.parse(localStorage.getItem('userFeedback') || '[]');
            setFeedbacks(localFeedback.map((fb, index) => ({
                id: index + 1,
                name: fb.name,
                feedback: fb.feedback,
                created_at: fb.timestamp,
                is_resolved: false
            })));
        } else {
            setFeedbacks(data || []);
        }
        setLoading(false);
    };

    const handleDeleteFeedback = async (feedbackId) => {
        if (!window.confirm('Are you sure you want to delete this feedback?')) {
            return;
        }

        const { error } = await deleteFeedback(feedbackId);

        if (error) {
            showMessage('error', 'Failed to delete feedback');
        } else {
            showMessage('success', 'Feedback deleted successfully');
            fetchFeedback();
        }
    };

    const handleToggleFeedbackStatus = async (feedbackId, currentStatus) => {
        const { error } = await updateFeedbackStatus(feedbackId, !currentStatus);

        if (error) {
            showMessage('error', 'Failed to update feedback status');
        } else {
            showMessage('success', 'Feedback status updated successfully');
            fetchFeedback();
        }
    };

    const handleApproveFeedback = async (feedbackId) => {
        const userId = JSON.parse(localStorage.getItem('user'))?.id;
        const { error } = await approveFeedback(feedbackId, userId);

        if (error) {
            showMessage('error', 'Failed to approve feedback');
        } else {
            showMessage('success', 'Feedback approved and will show on homepage');
            fetchFeedback();
        }
    };

    const handleRejectFeedback = async (feedbackId) => {
        const userId = JSON.parse(localStorage.getItem('user'))?.id;
        const { error } = await rejectFeedback(feedbackId, userId);

        if (error) {
            showMessage('error', 'Failed to reject feedback');
        } else {
            showMessage('success', 'Feedback rejected and hidden from homepage');
            fetchFeedback();
        }
    };

    // ==================== ORDERS ====================
    const fetchOrders = async () => {
        setLoading(true);
        const { data, error } = await getAllOrders();
        if (error) {
            showMessage('error', 'Failed to load orders');
            setOrders([]);
        } else {
            setOrders(data || []);
        }
        setLoading(false);
    };

    const handleOrderStatusChange = async (orderId, status) => {
        const { error } = await updateOrderStatus(orderId, status);

        if (error) {
            showMessage('error', 'Failed to update order status');
        } else {
            showMessage('success', 'Order status updated successfully');
            fetchOrders();
        }
    };

    const handleDeleteOrder = async (orderId) => {
        if (!window.confirm('Are you sure you want to delete this order?')) {
            return;
        }

        const { error } = await deleteOrder(orderId);

        if (error) {
            showMessage('error', 'Failed to delete order');
        } else {
            showMessage('success', 'Order deleted successfully');
            fetchOrders();
        }
    };

    const handleOpenJobFeedModal = (order) => {
        setEditingJobFeedOrder(order);
        setJobFeedDraft({
            title: order.job_feed_title || '',
            description: order.job_feed_description || '',
            isPosted: Boolean(order.is_job_feed_posted)
        });
        setShowJobFeedModal(true);
    };

    const handleCloseJobFeedModal = () => {
        setShowJobFeedModal(false);
        setEditingJobFeedOrder(null);
        setJobFeedDraft({
            title: '',
            description: '',
            isPosted: false
        });
    };

    const handleSaveOrderJobFeed = async (shouldPost = jobFeedDraft.isPosted) => {
        if (!editingJobFeedOrder) {
            return;
        }

        if (shouldPost && !canOrderBePostedToJobFeed(editingJobFeedOrder)) {
            showMessage('error', 'Only confirmed orders can be posted to the homepage job feed');
            return;
        }

        setJobFeedSaving(true);

        const nextPostedAt = shouldPost
            ? (editingJobFeedOrder.job_feed_posted_at || new Date().toISOString())
            : null;

        const { error } = await updateOrderJobFeed(editingJobFeedOrder.id, {
            job_feed_title: jobFeedDraft.title.trim() || null,
            job_feed_description: jobFeedDraft.description.trim() || null,
            is_job_feed_posted: shouldPost,
            job_feed_posted_at: nextPostedAt,
            updated_at: new Date().toISOString()
        });

        setJobFeedSaving(false);

        if (error) {
            showMessage('error', 'Failed to update homepage job feed');
            return;
        }

        const wasPosted = Boolean(editingJobFeedOrder.is_job_feed_posted);
        let successMessage = 'Job feed saved successfully';

        if (shouldPost) {
            successMessage = wasPosted ? 'Homepage job updated successfully' : 'Job posted to homepage successfully';
        } else if (wasPosted) {
            successMessage = 'Job removed from homepage successfully';
        }

        showMessage('success', successMessage);
        handleCloseJobFeedModal();
        fetchOrders();
    };

    const handleToggleOrderJobFeed = async (order) => {
        if (!order.is_job_feed_posted && !canOrderBePostedToJobFeed(order)) {
            showMessage('error', 'Only confirmed orders can be posted to the homepage job feed');
            return;
        }

        const nextPosted = !order.is_job_feed_posted;

        const { error } = await updateOrderJobFeed(order.id, {
            is_job_feed_posted: nextPosted,
            job_feed_posted_at: nextPosted ? (order.job_feed_posted_at || new Date().toISOString()) : null,
            updated_at: new Date().toISOString()
        });

        if (error) {
            showMessage('error', 'Failed to update homepage posting status');
            return;
        }

        showMessage('success', nextPosted ? 'Job posted to homepage' : 'Job removed from homepage');
        fetchOrders();
    };

    // ==================== INQUIRIES ====================
    const fetchInquiries = async () => {
        setLoading(true);
        const { data, error } = await getAllPropertyInquiries();
        if (error) {
            showMessage('error', 'Failed to load inquiries');
            setInquiries([]);
        } else {
            setInquiries(data || []);
        }
        setLoading(false);
    };

    const handleInquiryStatusChange = async (inquiryId, status) => {
        const { error } = await updateInquiryStatus(inquiryId, status);

        if (error) {
            showMessage('error', 'Failed to update inquiry status');
        } else {
            showMessage('success', 'Inquiry status updated successfully');
            fetchInquiries();
        }
    };

    const handleDeleteInquiry = async (inquiryId) => {
        if (!window.confirm('Are you sure you want to delete this inquiry?')) {
            return;
        }

        const { error } = await deleteInquiry(inquiryId);

        if (error) {
            showMessage('error', 'Failed to delete inquiry');
        } else {
            showMessage('success', 'Inquiry deleted successfully');
            fetchInquiries();
        }
    };

    // ==================== PRICING & CREDITS ====================
    const loadPricingData = async () => {
        setLoading(true);
        try {
            const [packages, costs, usersResult, resolvedTheme] = await Promise.all([
                getCreditPackages(),
                getCreditCosts(),
                getAllUsersWithCredits(),
                getSiteTheme()
            ]);

            setCreditPackagesState(packages || []);
            setCreditCosts(costs || {});
            setUsersWithCredits(usersResult?.data || []);
            setSiteTheme(resolvedTheme || 'light');
        } finally {
            setLoading(false);
        }
    };

    const handleAddPackage = async () => {
        if (!newPackage.name || newPackage.credits <= 0 || newPackage.price <= 0) {
            showMessage('error', 'Please fill all required fields');
            return;
        }

        const { error } = await addCreditPackage(newPackage);
        if (error) {
            showMessage('error', 'Failed to add package');
        } else {
            showMessage('success', 'Package added successfully');
            setShowAddPackageModal(false);
            setNewPackage({ name: '', credits: 100, price: 500, discount: 0, popular: false });
            loadPricingData();
        }
    };

    const handleUpdatePackage = async () => {
        if (!editingPackage.name || editingPackage.credits <= 0 || editingPackage.price <= 0) {
            showMessage('error', 'Please fill all required fields');
            return;
        }

        const { error } = await updateCreditPackage(editingPackage.id, editingPackage);
        if (error) {
            showMessage('error', 'Failed to update package');
        } else {
            showMessage('success', 'Package updated successfully');
            setShowEditPackageModal(false);
            setEditingPackage(null);
            loadPricingData();
        }
    };

    const handleDeletePackage = async (packageId) => {
        if (!window.confirm('Are you sure you want to delete this package?')) {
            return;
        }

        const { error } = await deleteCreditPackage(packageId);
        if (error) {
            showMessage('error', 'Failed to delete package');
        } else {
            showMessage('success', 'Package deleted successfully');
            loadPricingData();
        }
    };

    const handleTogglePackage = async (packageId) => {
        const { error } = await togglePackageStatus(packageId);
        if (error) {
            showMessage('error', 'Failed to toggle package status');
        } else {
            showMessage('success', 'Package status updated');
            loadPricingData();
        }
    };

    const handleSaveCreditCosts = async () => {
        const { success, error } = await saveCreditCosts(creditCosts);
        if (error) {
            showMessage('error', 'Failed to save credit costs');
        } else {
            showMessage('success', 'Credit costs saved successfully');
            if (success) {
                loadPricingData();
            }
        }
    };

    const handleSaveSiteTheme = async () => {
        setSavingSiteTheme(true);
        const { success, error, theme } = await saveSiteTheme(siteTheme);

        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent(SITE_THEME_EVENT, { detail: { theme } }));
        }

        if (error) {
            showMessage('error', 'Failed to save site theme');
        } else {
            showMessage('success', `Site theme switched to ${theme}`);
            if (success) {
                setSiteTheme(theme);
            }
        }
        setSavingSiteTheme(false);
    };

    const handleUpdateUserCredits = async () => {
        if (!selectedUserForCredit || creditAmount <= 0) {
            showMessage('error', 'Please select a user and enter a valid amount');
            return;
        }

        const { error } = await updateUserCredits(selectedUserForCredit.id, creditAmount, creditAction);
        if (error) {
            showMessage('error', 'Failed to update user credits');
        } else {
            showMessage('success', `Credits ${creditAction === 'add' ? 'added to' : 'subtracted from'} user successfully`);
            setShowCreditModal(false);
            setSelectedUserForCredit(null);
            setCreditAmount(0);
            loadPricingData();
        }
    };

    const calculateFinalPrice = (pkg) => {
        const discount = (pkg.price * pkg.discount) / 100;
        return pkg.price - discount;
    };

    return (
        <div className='flex h-screen bg-gray-50'>
            {/* Sidebar for Desktop */}
            <aside className='hidden md:flex md:flex-col w-64 bg-white fixed h-full shadow-lg'>
                <div className='p-6 border-b'>
                    <img
                        src={LOGO_SRC}
                        alt="Logo"
                        className='w-40'
                        onError={(event) => {
                            event.currentTarget.src = LOGO_FALLBACK_SRC;
                        }}
                    />
                    <p className='text-sm text-gray-500 mt-2 font-semibold'>Admin Control Panel</p>
                </div>

                <nav className='flex-1 p-4 space-y-2 overflow-y-auto scrollbar-gray-400'>
                    <Link to='/'>
                        <button className='w-full flex items-center gap-3 px-4 py-3 text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-colors duration-200'>
                            <BiHome className='text-xl' />
                            <span className='font-medium'>Go to Homepage</span>
                        </button>
                    </Link>

                    <div className='pt-4 space-y-1'>
                        {menuItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => handleMenuChange(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                                    activeMenu === item.id
                                        ? 'bg-primary-50 text-primary-600 border-l-4 border-primary-600'
                                        : 'text-gray-600 hover:bg-gray-100'
                                }`}
                            >
                                {item.icon}
                                <span className='font-medium'>{item.label}</span>
                            </button>
                        ))}
                    </div>
                </nav>
            </aside>

            {/* Mobile Sidebar */}
            <div className={`md:hidden fixed inset-0 z-50 transition-opacity duration-300 ${sidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
                <div
                    className='absolute inset-0 backdrop-blur-md'
                    onClick={() => setSidebarOpen(false)}
                />

                <aside className={`absolute left-0 top-0 bottom-0 w-72 bg-white shadow-2xl overflow-y-auto scrollbar-gray-400 transition-all duration-500 ease-in-out ${
                    sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                }`}>
                    <div className='flex justify-end p-4'>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className='text-2xl p-2 hover:bg-gray-100 rounded-full transition-all duration-300 hover:rotate-90'
                        >
                            <RxCross2 />
                        </button>
                    </div>

                    <div className='px-6 pb-4 border-b animate-in fade-in slide-in-from-top duration-500'>
                        <img
                            src={LOGO_SRC}
                            alt="Logo"
                            className='w-40'
                            onError={(event) => {
                                event.currentTarget.src = LOGO_FALLBACK_SRC;
                            }}
                        />
                        <p className='text-sm text-gray-500 mt-2 font-semibold'>Admin Control Panel</p>
                    </div>

                    <nav className='p-4 space-y-2'>
                        <Link to='/'>
                            <button className='w-full flex items-center gap-3 px-4 py-3 text-white bg-primary-500 hover:bg-primary-600 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-lg'>
                                <BiHome className='text-xl' />
                                <span className='font-medium'>Go to Homepage</span>
                            </button>
                        </Link>

                        <div className='pt-4 space-y-2'>
                            {menuItems.map((item, index) => (
                                <button
                                    key={item.id}
                                    onClick={() => {
                                        handleMenuChange(item.id);
                                        setSidebarOpen(false);
                                    }}
                                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 hover:scale-105 hover:shadow-md ${
                                        activeMenu === item.id
                                            ? 'bg-primary-50 text-primary-600 border-l-4 border-primary-600 shadow-md'
                                            : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                    style={{
                                        transitionDelay: sidebarOpen ? `${index * 50}ms` : '0ms',
                                        opacity: sidebarOpen ? 1 : 0,
                                        transform: sidebarOpen ? 'translateX(0)' : 'translateX(-20px)'
                                    }}
                                >
                                    {item.icon}
                                    <span className='font-medium'>{item.label}</span>
                                </button>
                            ))}
                        </div>
                    </nav>
                </aside>
            </div>

            {/* Main Content Area */}
            <main className='flex-1 md:ml-64 overflow-y-auto scrollbar-gray-400'>
                <header className='bg-white shadow-sm sticky top-0 z-10'>
                    <div className='flex flex-col md:flex-row items-start md:items-center justify-between gap-4 px-6 py-4'>
                        <div className='flex items-center gap-4 w-full md:w-auto'>
                            <button
                                onClick={() => setSidebarOpen(true)}
                                className='md:hidden text-2xl text-gray-600'
                            >
                                <TfiMenu />
                            </button>
                            <h1 className='text-xl md:text-2xl font-semibold text-gray-800'>
                                {menuItems.find(item => item.id === activeMenu)?.label || 'Admin Control Panel'}
                            </h1>
                        </div>

                        {/* Search Bar */}
                        {['users', 'properties', 'orders', 'inquiries', 'feedback'].includes(activeMenu) && (
                            <div className='relative w-full md:w-96'>
                                <input
                                    type='text'
                                    placeholder={`Search ${activeMenu}...`}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-700'
                                />
                                <svg className='absolute left-3 top-2.5 w-5 h-5 text-gray-400' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                    <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z' />
                                </svg>
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        className='absolute right-3 top-2.5 text-gray-400 hover:text-gray-600'
                                    >
                                        <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
                                        </svg>
                                    </button>
                                )}
                            </div>
                        )}

                        <div className='flex items-center gap-4'>
                            <span className='text-sm text-gray-600 flex items-center gap-2'>
                                <FaUserShield className='text-primary-600' />
                                {currentUser?.name || 'Admin'}
                            </span>
                        </div>
                    </div>
                </header>

                {/* Message Alert */}
                {message.text && (
                    <div className={`mx-6 mt-6 p-4 rounded-lg ${
                        message.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                    }`}>
                        <p className={`${message.type === 'success' ? 'text-green-600' : 'text-red-600'} font-medium`}>
                            {message.text}
                        </p>
                    </div>
                )}

                {/* Loading Spinner */}
                {loading && (
                    <div className='flex items-center justify-center py-12'>
                        <div className='flex flex-col items-center gap-3'>
                            <div className='w-12 h-12 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin'></div>
                            <p className='text-gray-500 text-sm'>Loading...</p>
                        </div>
                    </div>
                )}

                {/* Content Area */}
                <div className={`p-6 ${loading ? 'hidden' : ''}`}>
                    {/* DASHBOARD */}
                    {activeMenu === 'dashboard' && (
                        <div className='space-y-6'>
                            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                                <div className='bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-lg shadow-lg text-white'>
                                    <div className='flex items-center justify-between'>
                                        <div>
                                            <p className='text-blue-100 text-sm'>Total Admin Users</p>
                                            <h3 className='text-4xl font-bold mt-2'>{stats.totalUsers}</h3>
                                            <p className='text-blue-100 text-xs mt-1'>{stats.activeUsers} active</p>
                                        </div>
                                        <BiUser className='text-6xl text-blue-200 opacity-50' />
                                    </div>
                                </div>

                                <div className='bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-lg shadow-lg text-white'>
                                    <div className='flex items-center justify-between'>
                                        <div>
                                            <p className='text-green-100 text-sm'>Total Properties</p>
                                            <h3 className='text-4xl font-bold mt-2'>{stats.totalProperties}</h3>
                                            <p className='text-green-100 text-xs mt-1'>{stats.pendingProperties} pending</p>
                                        </div>
                                        <GiHouse className='text-6xl text-green-200 opacity-50' />
                                    </div>
                                </div>

                                <div className='bg-gradient-to-br from-purple-500 to-purple-600 p-6 rounded-lg shadow-lg text-white'>
                                    <div className='flex items-center justify-between'>
                                        <div>
                                            <p className='text-purple-100 text-sm'>Total Orders</p>
                                            <h3 className='text-4xl font-bold mt-2'>{stats.totalOrders}</h3>
                                            <p className='text-purple-100 text-xs mt-1'>All time</p>
                                        </div>
                                        <BiPackage className='text-6xl text-purple-200 opacity-50' />
                                    </div>
                                </div>

                                <div className='bg-gradient-to-br from-orange-500 to-orange-600 p-6 rounded-lg shadow-lg text-white'>
                                    <div className='flex items-center justify-between'>
                                        <div>
                                            <p className='text-orange-100 text-sm'>Total Feedback</p>
                                            <h3 className='text-4xl font-bold mt-2'>{stats.totalFeedback}</h3>
                                            <p className='text-orange-100 text-xs mt-1'>User responses</p>
                                        </div>
                                        <MdFeedback className='text-6xl text-orange-200 opacity-50' />
                                    </div>
                                </div>

                                <div className='bg-gradient-to-br from-pink-500 to-pink-600 p-6 rounded-lg shadow-lg text-white'>
                                    <div className='flex items-center justify-between'>
                                        <div>
                                            <p className='text-pink-100 text-sm'>Cover Photos</p>
                                            <h3 className='text-4xl font-bold mt-2'>{coverPhotos.length || 0}</h3>
                                            <p className='text-pink-100 text-xs mt-1'>Active images</p>
                                        </div>
                                        <BiImage className='text-6xl text-pink-200 opacity-50' />
                                    </div>
                                </div>

                                <div className='bg-gradient-to-br from-primary-500 to-primary-600 p-6 rounded-lg shadow-lg text-white'>
                                    <div className='flex items-center justify-between'>
                                        <div>
                                            <p className='text-primary-100 text-sm'>Pending Review</p>
                                            <h3 className='text-4xl font-bold mt-2'>{stats.pendingProperties}</h3>
                                            <p className='text-primary-100 text-xs mt-1'>Properties awaiting</p>
                                        </div>
                                        <MdSettings className='text-6xl text-primary-200 opacity-50' />
                                    </div>
                                </div>

                                <div className='bg-gradient-to-br from-cyan-500 to-cyan-600 p-6 rounded-lg shadow-lg text-white'>
                                    <div className='flex items-center justify-between'>
                                        <div>
                                            <p className='text-cyan-100 text-sm'>Today's Listings</p>
                                            <h3 className='text-4xl font-bold mt-2'>{listingReport.todaysNewListings}</h3>
                                            <p className='text-cyan-100 text-xs mt-1'>New properties created today</p>
                                        </div>
                                        <MdAdd className='text-6xl text-cyan-200 opacity-50' />
                                    </div>
                                </div>

                                <div className='bg-gradient-to-br from-indigo-500 to-indigo-600 p-6 rounded-lg shadow-lg text-white'>
                                    <div className='flex items-center justify-between'>
                                        <div>
                                            <p className='text-indigo-100 text-sm'>Last 7 Days</p>
                                            <h3 className='text-4xl font-bold mt-2'>{listingReport.totalNewListings}</h3>
                                            <p className='text-indigo-100 text-xs mt-1'>New listings added recently</p>
                                        </div>
                                        <MdDashboard className='text-6xl text-indigo-200 opacity-50' />
                                    </div>
                                </div>
                            </div>

                            <div className='bg-white rounded-lg shadow p-6'>
                                <div className='flex items-start justify-between gap-4 mb-4'>
                                    <div>
                                        <h2 className='text-xl font-semibold text-gray-900'>Listing Report</h2>
                                        <p className='text-sm text-gray-500'>New property listings created in the last 7 days</p>
                                    </div>
                                    <div className='rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700'>
                                        Total: <span className='font-semibold text-gray-900'>{listingReport.totalNewListings}</span>
                                    </div>
                                </div>
                                <div className='space-y-3'>
                                    {listingReport.dailyCounts.map((day) => {
                                        const maxCount = Math.max(...listingReport.dailyCounts.map((item) => item.count), 1);
                                        const width = `${Math.max((day.count / maxCount) * 100, day.count > 0 ? 12 : 0)}%`;

                                        return (
                                            <div key={day.date} className='grid grid-cols-[80px_1fr_40px] items-center gap-3'>
                                                <span className='text-sm font-medium text-gray-600'>{day.label}</span>
                                                <div className='h-3 rounded-full bg-gray-100 overflow-hidden'>
                                                    <div
                                                        className='h-full rounded-full bg-gradient-to-r from-primary-500 to-cyan-500'
                                                        style={{ width }}
                                                    />
                                                </div>
                                                <span className='text-right text-sm font-semibold text-gray-900'>{day.count}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className='bg-white rounded-lg shadow p-6'>
                                <h2 className='text-xl font-semibold mb-4'>Quick Actions</h2>
                                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                                    <button
                                        onClick={() => handleMenuChange('users')}
                                        className='p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 transition-colors text-left'
                                    >
                                        <BiUser className='text-3xl text-blue-600 mb-2' />
                                        <h3 className='font-semibold text-gray-800'>Manage Users</h3>
                                        <p className='text-sm text-gray-600'>View and manage all users</p>
                                    </button>
                                    <button
                                        onClick={() => handleMenuChange('properties')}
                                        className='p-4 border-2 border-green-200 rounded-lg hover:bg-green-50 transition-colors text-left'
                                    >
                                        <GiHouse className='text-3xl text-green-600 mb-2' />
                                        <h3 className='font-semibold text-gray-800'>Review Properties</h3>
                                        <p className='text-sm text-gray-600'>Approve or reject listings</p>
                                    </button>
                                    <button
                                        onClick={() => handleMenuChange('cover-photos')}
                                        className='p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 transition-colors text-left'
                                    >
                                        <BiImage className='text-3xl text-purple-600 mb-2' />
                                        <h3 className='font-semibold text-gray-800'>Update Cover Photos</h3>
                                        <p className='text-sm text-gray-600'>Manage homepage carousel</p>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PRICING & CREDITS SECTION */}
                    {activeMenu === 'pricing' && (
                        <div className='space-y-6'>
                            {/* Price Bar - Visual Summary */}
                            <div className='bg-gradient-to-r from-primary-600 to-purple-600 rounded-xl shadow-lg p-6 text-white'>
                                <h2 className='text-2xl font-bold mb-4'>Credit Pricing Overview</h2>
                                <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                                    <div className='bg-white/10 rounded-lg p-4'>
                                        <p className='text-primary-200 text-sm'>Total Packages</p>
                                        <p className='text-3xl font-bold'>{creditPackages.length}</p>
                                    </div>
                                    <div className='bg-white/10 rounded-lg p-4'>
                                        <p className='text-primary-200 text-sm'>Active Packages</p>
                                        <p className='text-3xl font-bold'>{creditPackages.filter(p => p.is_active !== false).length}</p>
                                    </div>
                                    <div className='bg-white/10 rounded-lg p-4'>
                                        <p className='text-primary-200 text-sm'>Property Listing Cost</p>
                                        <p className='text-3xl font-bold'>{creditCosts.property_listing || 20}</p>
                                    </div>
                                    <div className='bg-white/10 rounded-lg p-4'>
                                        <p className='text-primary-200 text-sm'>Contact View Cost</p>
                                        <p className='text-3xl font-bold'>{creditCosts.contact_view || 10}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Credit Costs Configuration */}
                            <div className='bg-white rounded-lg shadow p-6'>
                                <h3 className='text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900'>
                                    <MdSettings className='text-primary-600' />
                                    Credit Cost Settings
                                </h3>
                                <div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
                                    <div>
                                        <label className='block text-sm font-medium text-gray-700 mb-2'>
                                            Property Listing Cost
                                        </label>
                                        <input
                                            type='number'
                                            value={creditCosts.property_listing || 20}
                                            onChange={(e) => setCreditCosts({ ...creditCosts, property_listing: parseInt(e.target.value) || 0 })}
                                            className='w-full text-gray-400 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
                                            min='0'
                                        />
                                    </div>
                                    <div>
                                        <label className='block text-sm font-medium text-gray-700 mb-2'>
                                            Contact View Cost
                                        </label>
                                        <input
                                            type='number'
                                            value={creditCosts.contact_view || 10}
                                            onChange={(e) => setCreditCosts({ ...creditCosts, contact_view: parseInt(e.target.value) || 0 })}
                                            className='w-full text-gray-400 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
                                            min='0'
                                        />
                                    </div>
                                    <div>
                                        <label className='block text-sm font-medium text-gray-700 mb-2'>
                                            Photo View Cost
                                        </label>
                                        <input
                                            type='number'
                                            value={creditCosts.photo_view || 10}
                                            onChange={(e) => setCreditCosts({ ...creditCosts, photo_view: parseInt(e.target.value) || 0 })}
                                            className='w-full text-gray-400 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
                                            min='0'
                                        />
                                    </div>
                                </div>
                                <button
                                    onClick={handleSaveCreditCosts}
                                    className='mt-4 flex items-center gap-2 bg-primary-500 text-white px-6 py-2 rounded-lg hover:bg-primary-600 transition-colors'
                                >
                                    <FaSave />
                                    Save Credit Costs
                                </button>
                            </div>

                            <div className='bg-white rounded-lg shadow p-6'>
                                <h3 className='text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900'>
                                    <MdSettings className='text-primary-600' />
                                    Website Theme
                                </h3>
                                <p className='text-sm text-gray-500 mb-4'>
                                    Default website mode should stay light unless you explicitly switch it to dark.
                                </p>
                                <div className='flex flex-col md:flex-row items-start md:items-end gap-4'>
                                    <div className='w-full md:max-w-xs'>
                                        <label className='block text-sm font-medium text-gray-700 mb-2'>
                                            Theme Mode
                                        </label>
                                        <select
                                            value={siteTheme}
                                            onChange={(e) => setSiteTheme(e.target.value)}
                                            className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-gray-700'
                                        >
                                            <option value='light'>Light</option>
                                            <option value='dark'>Dark</option>
                                        </select>
                                    </div>
                                    <button
                                        onClick={handleSaveSiteTheme}
                                        disabled={savingSiteTheme}
                                        className='flex items-center gap-2 bg-primary-500 text-white px-6 py-2 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed'
                                    >
                                        <FaSave />
                                        {savingSiteTheme ? 'Saving Theme...' : 'Save Theme'}
                                    </button>
                                </div>
                            </div>

                            {/* Credit Packages */}
                            <div className='bg-white rounded-lg shadow p-6'>
                                <div className='flex justify-between items-center mb-6'>
                                    <div>
                                        <h3 className='text-lg font-semibold flex items-center text-black gap-2'>
                                            <BiCreditCard className='text-primary-600' />
                                            Credit Packages
                                        </h3>
                                        <p className='text-gray-500 text-sm'>Manage packages available for purchase in Book page</p>
                                    </div>
                                    <button
                                        onClick={() => setShowAddPackageModal(true)}
                                        className='flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors'
                                    >
                                        <MdAdd className='text-xl' />
                                        Add Package
                                    </button>
                                </div>

                                {loading ? (
                                    <div className='text-center py-12'>
                                        <div className='inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600'></div>
                                    </div>
                                ) : (
                                    <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4'>
                                        {creditPackages.map((pkg) => (
                                            <div
                                                key={pkg.id}
                                                className={`relative border-2 rounded-xl p-4 ${
                                                    pkg.is_active !== false
                                                        ? pkg.popular ? 'border-primary-500 bg-primary-50' : 'border-gray-200'
                                                        : 'border-gray-200 bg-gray-100 opacity-60'
                                                }`}
                                            >
                                                {pkg.popular && (
                                                    <span className='absolute -top-3 left-1/2 transform -translate-x-1/2 bg-primary-600 text-white px-3 py-1 rounded-full text-xs font-bold'>
                                                        Popular
                                                    </span>
                                                )}
                                                {pkg.is_active === false && (
                                                    <span className='absolute top-2 right-2 bg-gray-500 text-white px-2 py-1 rounded text-xs'>
                                                        Inactive
                                                    </span>
                                                )}
                                                <h4 className='text-lg font-bold text-gray-900 mt-2'>{pkg.name}</h4>
                                                <div className='mt-2'>
                                                    <span className='text-3xl font-bold text-primary-600'>{pkg.credits}</span>
                                                    <span className='text-gray-600 text-sm ml-1'>credits</span>
                                                </div>
                                                <div className='mt-2'>
                                                    {pkg.discount > 0 && (
                                                        <span className='text-gray-400 line-through text-sm mr-2'>৳{pkg.price}</span>
                                                    )}
                                                    <span className='text-xl font-semibold text-gray-900'>৳{calculateFinalPrice(pkg)}</span>
                                                    {pkg.discount > 0 && (
                                                        <span className='ml-2 bg-red-100 text-red-600 px-2 py-1 rounded text-xs font-bold'>
                                                            {pkg.discount}% OFF
                                                        </span>
                                                    )}
                                                </div>
                                                <p className='text-xs text-gray-500 mt-1'>
                                                    ৳{(calculateFinalPrice(pkg) / pkg.credits).toFixed(2)} per credit
                                                </p>
                                                <div className='flex gap-2 mt-4'>
                                                    <button
                                                        onClick={() => {
                                                            setEditingPackage({ ...pkg });
                                                            setShowEditPackageModal(true);
                                                        }}
                                                        className='flex-1 bg-blue-50 text-blue-600 px-2 py-2 rounded hover:bg-blue-100 text-xs font-medium'
                                                    >
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleTogglePackage(pkg.id)}
                                                        className={`flex-1 px-2 py-2 rounded text-xs font-medium ${
                                                            pkg.is_active !== false
                                                                ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100'
                                                                : 'bg-green-50 text-green-600 hover:bg-green-100'
                                                        }`}
                                                    >
                                                        {pkg.is_active !== false ? 'Disable' : 'Enable'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeletePackage(pkg.id)}
                                                        className='bg-red-50 text-red-600 px-2 py-2 rounded hover:bg-red-100 text-xs font-medium'
                                                    >
                                                        <MdDelete />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* User Credits Management */}
                            <div className='bg-white rounded-lg shadow p-6'>
                                <h3 className='text-lg font-semibold mb-4 flex items-center gap-2 text-black'>
                                    <BiUser className='text-primary-600' />
                                    User Credits Management
                                </h3>
                                <p className='text-gray-500 text-sm mb-4'>Manually adjust user credits</p>

                                {usersWithCredits.length === 0 ? (
                                    <p className='text-gray-500 text-center py-8'>No users found</p>
                                ) : (
                                    <div className='overflow-x-auto'>
                                        <table className='min-w-full divide-y divide-gray-200'>
                                            <thead className='bg-gray-50'>
                                                <tr>
                                                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>User</th>
                                                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>Email</th>
                                                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>Credits</th>
                                                    <th className='px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase'>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className='bg-white divide-y divide-gray-200'>
                                                {usersWithCredits.slice(0, 10).map((user) => (
                                                    <tr key={user.id} className='hover:bg-gray-50'>
                                                        <td className='px-4 py-3 whitespace-nowrap'>
                                                            <span className='font-medium text-gray-900'>{user.name || 'Unknown'}</span>
                                                        </td>
                                                        <td className='px-4 py-3 whitespace-nowrap text-sm text-gray-500'>
                                                            {user.email}
                                                        </td>
                                                        <td className='px-4 py-3 whitespace-nowrap'>
                                                            <span className='inline-flex items-center px-3 py-1 rounded-full text-sm font-bold bg-primary-100 text-primary-800'>
                                                                {user.credits || 0}
                                                            </span>
                                                        </td>
                                                        <td className='px-4 py-3 whitespace-nowrap'>
                                                            <button
                                                                onClick={() => {
                                                                    setSelectedUserForCredit(user);
                                                                    setCreditAmount(0);
                                                                    setCreditAction('add');
                                                                    setShowCreditModal(true);
                                                                }}
                                                                className='text-primary-600 hover:text-primary-900 font-medium text-sm'
                                                            >
                                                                Modify Credits
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* COVER PHOTOS SECTION */}
                    {activeMenu === 'cover-photos' && (
                        <div className='space-y-6'>
                            <div className='flex justify-between items-center'>
                                <div>
                                    <h2 className='text-xl font-semibold text-gray-900'>Manage Cover Photos</h2>
                                    <p className='text-gray-500 text-sm mt-1'>Control homepage carousel images</p>
                                </div>
                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className='flex items-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors'
                                >
                                    <MdAdd className='text-xl' />
                                    Add Photo
                                </button>
                            </div>

                            {loading ? (
                                <div className='text-center py-12'>
                                    <div className='inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600'></div>
                                    <p className='text-gray-500 mt-4'>Loading cover photos...</p>
                                </div>
                            ) : coverPhotos.length === 0 ? (
                                <div className='bg-white rounded-lg shadow p-12 text-center'>
                                    <BiImage className='text-6xl text-gray-300 mx-auto mb-4' />
                                    <h3 className='text-lg font-medium text-gray-900 mb-2'>No cover photos yet</h3>
                                    <p className='text-gray-500 mb-6'>Get started by adding your first cover photo</p>
                                    <button
                                        onClick={() => setShowAddModal(true)}
                                        className='bg-primary-500 text-white px-6 py-2 rounded-lg hover:bg-primary-600'
                                    >
                                        Add First Photo
                                    </button>
                                </div>
                            ) : (
                                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                                    {coverPhotos.map((photo) => (
                                        <div key={photo.id} className='bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow'>
                                            <div className='relative h-48'>
                                                <img
                                                    src={photo.image_url}
                                                    alt={`Cover ${photo.order_index}`}
                                                    className='w-full h-full object-cover'
                                                    onError={(e) => {
                                                        e.target.src = 'https://via.placeholder.com/400x300?text=Image+Not+Found';
                                                    }}
                                                />
                                                <div className='absolute top-2 right-2'>
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        photo.is_active
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {photo.is_active ? 'Active' : 'Inactive'}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className='p-4'>
                                                <p className='text-sm text-gray-500 mb-3'>Order: {photo.order_index}</p>
                                                <div className='flex gap-2'>
                                                    <button
                                                        onClick={() => {
                                                            setEditingPhoto({ ...photo });
                                                            setShowEditModal(true);
                                                        }}
                                                        className='flex-1 flex items-center justify-center gap-2 bg-blue-50 text-blue-600 px-3 py-2 rounded hover:bg-blue-100 transition-colors text-sm'
                                                    >
                                                        <MdEdit />
                                                        Edit
                                                    </button>
                                                    <button
                                                        onClick={() => handleTogglePhotoStatus(photo.id, photo.is_active)}
                                                        className='flex-1 flex items-center justify-center gap-2 bg-yellow-50 text-yellow-600 px-3 py-2 rounded hover:bg-yellow-100 transition-colors text-sm'
                                                    >
                                                        {photo.is_active ? <FaEyeSlash /> : <FaEye />}
                                                        {photo.is_active ? 'Hide' : 'Show'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeletePhoto(photo.id)}
                                                        className='flex items-center justify-center gap-2 bg-red-50 text-red-600 px-3 py-2 rounded hover:bg-red-100 transition-colors text-sm'
                                                    >
                                                        <MdDelete />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* USERS SECTION */}
                    {activeMenu === 'users' && (
                        <div className='space-y-6'>
                            <div>
                                <h2 className='text-xl font-semibold text-black'>User Management</h2>
                                <p className='text-gray-500 text-sm mt-1'>Control user accounts, admin access, and employee tags</p>
                                <p className='text-xs text-gray-400 mt-1'>Employee is an internal label only. It does not allow admin login.</p>
                            </div>

                            {loading ? (
                                <div className='text-center py-12'>
                                    <div className='inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600'></div>
                                    <p className='text-gray-500 mt-4'>Loading users...</p>
                                </div>
                            ) : users.filter(user =>
                                !searchQuery ||
                                user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                user.phone?.includes(searchQuery)
                            ).length === 0 ? (
                                <div className='bg-white rounded-lg shadow p-12 text-center'>
                                    <BiUser className='text-6xl text-gray-300 mx-auto mb-4' />
                                    <h3 className='text-lg font-medium text-gray-900 mb-2'>No users found</h3>
                                    <p className='text-gray-500'>Users will appear here once they register</p>
                                </div>
                            ) : (
                                <div className='bg-white rounded-lg shadow overflow-hidden'>
                                    <div className='overflow-x-auto'>
                                        <table className='min-w-full divide-y divide-gray-200'>
                                            <thead className='bg-gray-50'>
                                                <tr>
                                                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>User</th>
                                                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Email</th>
                                                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Phone</th>
                                                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Role</th>
                                                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Status</th>
                                                    <th className='px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider'>Actions</th>
                                                </tr>
                                            </thead>
                                            <tbody className='bg-white divide-y divide-gray-200'>
                                                {users.filter(user =>
                                                    !searchQuery ||
                                                    user.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                                    user.phone?.includes(searchQuery)
                                                ).map((user) => (
                                                    <tr key={user.id} className='hover:bg-gray-50'>
                                                        <td className='px-6 py-4 whitespace-nowrap'>
                                                            <div className='flex items-center'>
                                                                <div className='h-10 w-10 flex-shrink-0'>
                                                                    <div className='h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center'>
                                                                        <span className='text-primary-600 font-medium'>
                                                                            {user.name?.charAt(0).toUpperCase() || 'U'}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className='ml-4'>
                                                                    <div className='text-sm font-medium text-gray-900'>{user.name || 'Unknown'}</div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className='px-6 py-4 whitespace-nowrap'>
                                                            <div className='text-sm text-gray-900'>{user.email || 'N/A'}</div>
                                                        </td>
                                                        <td className='px-6 py-4 whitespace-nowrap'>
                                                            <div className='text-sm text-gray-900'>{user.phone || 'N/A'}</div>
                                                        </td>
                                                        <td className='px-6 py-4 whitespace-nowrap'>
                                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                                getUserRoleClasses(user)
                                                            }`}>
                                                                {getUserRoleLabel(user)}
                                                            </span>
                                                        </td>
                                                        <td className='px-6 py-4 whitespace-nowrap'>
                                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                                                user.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                                            }`}>
                                                                {user.is_active ? 'Active' : 'Blocked'}
                                                            </span>
                                                        </td>
                                                        <td className='px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2'>
                                                            <button
                                                                onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                                                                className={`${
                                                                    user.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'
                                                                }`}
                                                            >
                                                                {user.is_active ? 'Block' : 'Unblock'}
                                                            </button>
                                                            <button
                                                                onClick={() => handleToggleAdminRole(user.id, user.is_admin)}
                                                                className='text-purple-600 hover:text-purple-900'
                                                            >
                                                                {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                                                            </button>
                                                            {!user.is_admin && (
                                                                <button
                                                                    onClick={() => handleToggleEmployeeRole(user.id, user.is_employee)}
                                                                    className='text-sky-600 hover:text-sky-900'
                                                                >
                                                                    {user.is_employee ? 'Remove Employee' : 'Make Employee'}
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={() => handleDeleteUser(user.id)}
                                                                className='text-red-600 hover:text-red-900'
                                                            >
                                                                Delete
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* PROPERTIES SECTION */}
                    {activeMenu === 'properties' && (
                        <div className='space-y-6'>
                            <div className='flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4'>
                                <div>
                                    <h2 className='text-xl font-semibold text-black'>Property Listings Control</h2>
                                    <p className='text-gray-500 text-sm mt-1'>Review and manage property approvals</p>
                                </div>
                                <div className='flex gap-2 overflow-x-auto pb-2 sm:pb-0 scrollbar-hide scroll-smooth w-full sm:w-auto touch-pan-x'>
                                    <style>{`
                                        .scrollbar-hide {-ms-overflow-style: none; scrollbar-width: none;}
                                        .scrollbar-hide::-webkit-scrollbar {display: none;}
                                        .scrollbar-gray-400::-webkit-scrollbar {width: 8px;}
                                        .scrollbar-gray-400::-webkit-scrollbar-track {background: #f3f4f6;}
                                        .scrollbar-gray-400::-webkit-scrollbar-thumb {background: #9ca3af; border-radius: 4px;}
                                        .scrollbar-gray-400::-webkit-scrollbar-thumb:hover {background: #6b7280;}
                                    `}</style>
                                    <button
                                        onClick={() => setPropertyFilter('all')}
                                        className={`px-4 py-2 rounded-lg text-sm ${propertyFilter === 'all' ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                                    >
                                        All({properties.length})
                                    </button>
                                    <button
                                        onClick={() => setPropertyFilter('pending')}
                                        className={`px-4 py-2 rounded-lg text-sm ${propertyFilter === 'pending' ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                                    >
                                        Pending({properties.filter(p => p.status === 'pending').length})
                                    </button>
                                    <button
                                        onClick={() => setPropertyFilter('approved')}
                                        className={`px-4 py-2 rounded-lg text-sm ${propertyFilter === 'approved' ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                                    >
                                        Approved({properties.filter(p => p.status === 'approved').length})
                                    </button>
                                    <button
                                        onClick={() => setPropertyFilter('rejected')}
                                        className={`px-4 py-2 rounded-lg text-sm ${propertyFilter === 'rejected' ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-700'}`}
                                    >
                                        Rejected({properties.filter(p => p.status === 'rejected').length})
                                    </button>
                                </div>
                            </div>

                            {/* Auto-Approve Toggle */}
                            <div className='flex items-center justify-between bg-white rounded-lg shadow p-4'>
                                <span className='text-gray-700 font-medium'>Auto-Approve Properties</span>
                                <button
                                    onClick={handleToggleAutoApprove}
                                    className='relative w-14 h-7 rounded-full focus:outline-none transition-colors duration-300'
                                    style={{ backgroundColor: autoApproveEnabled ? '#22c55e' : '#d1d5db' }}
                                >
                                    <div
                                        className='absolute top-0.5 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300'
                                        style={{ left: autoApproveEnabled ? '28px' : '2px' }}
                                    ></div>
                                </button>
                            </div>

                            {loading ? (
                                <div className='text-center py-12'>
                                    <div className='inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600'></div>
                                    <p className='text-gray-500 mt-4'>Loading properties...</p>
                                </div>
                            ) : filteredProperties.length === 0 ? (
                                <div className='bg-white rounded-lg shadow p-12 text-center'>
                                    <GiHouse className='text-6xl text-gray-300 mx-auto mb-4' />
                                    <h3 className='text-lg font-medium text-gray-900 mb-2'>No properties found</h3>
                                    <p className='text-gray-500'>Properties will appear here once they are submitted</p>
                                </div>
                            ) : (
                                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
                                    {filteredProperties.map((property) => (
                                        <div key={property.id} className='bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition-shadow'>
                                            <div className='relative h-48'>
                                                <img
                                                    src={property.images && property.images.length > 0 ? property.images[0] : 'https://via.placeholder.com/400x300?text=No+Image'}
                                                    alt={property.category || property.title}
                                                    className='w-full h-full object-cover'
                                                />
                                                <div className='absolute top-2 right-2 flex gap-2'>
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        property.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                        property.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                        'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                        {property.status || 'Pending'}
                                                    </span>
                                                    {property.is_featured && (
                                                        <span className='px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800'>
                                                            Featured
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className='p-4'>
                                                <h3 className='font-semibold text-gray-900 mb-1'>{property.category || property.title || 'Untitled Property'}</h3>
                                                <p className='text-sm text-gray-600 mb-1'>
                                                    {property.location?.area ? `${property.location.area}, ${property.location.state_district}` : (property.location || 'Location not specified')}
                                                </p>
                                                {property.pricing && (
                                                    <p className='text-sm font-medium text-primary-600 mb-3'>
                                                        ৳{property.pricing.rent_amount_bdt?.toLocaleString()} / {property.pricing.rent_period?.toLowerCase()}
                                                    </p>
                                                )}
                                                <div className='flex gap-2 mb-3'>
                                                    {property.status !== 'approved' && (
                                                        <button
                                                            onClick={() => handlePropertyStatusChange(property.id, 'approved')}
                                                            className='flex-1 flex items-center justify-center gap-1 bg-green-50 text-green-600 px-2 py-2 rounded hover:bg-green-100 transition-colors text-xs'
                                                        >
                                                            <MdCheckCircle />
                                                            Approve
                                                        </button>
                                                    )}
                                                    {property.status !== 'rejected' && (
                                                        <button
                                                            onClick={() => handlePropertyStatusChange(property.id, 'rejected')}
                                                            className='flex-1 flex items-center justify-center gap-1 bg-red-50 text-red-600 px-2 py-2 rounded hover:bg-red-100 transition-colors text-xs'
                                                        >
                                                            <MdCancel />
                                                            Reject
                                                        </button>
                                                    )}
                                                </div>
                                                <div className='flex gap-2'>
                                                    <button
                                                        onClick={() => handleToggleFeatured(property.id, property.is_featured)}
                                                        className='flex-1 flex items-center justify-center gap-1 bg-purple-50 text-purple-600 px-2 py-2 rounded hover:bg-purple-100 transition-colors text-xs'
                                                    >
                                                        {property.is_featured ? <FaRegStar /> : <FaStar />}
                                                        {property.is_featured ? 'Unfeature' : 'Feature'}
                                                    </button>
                                                    <button
                                                        onClick={() => handleDeleteProperty(property.id)}
                                                        className='flex items-center justify-center gap-1 bg-red-50 text-red-600 px-2 py-2 rounded hover:bg-red-100 transition-colors text-xs'
                                                    >
                                                        <MdDelete />
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ORDERS SECTION */}
                    {activeMenu === 'orders' && (
                        <div className='space-y-6'>
                            <div>
                                <h2 className='text-xl font-semibold text-black'>Property Requirement Orders</h2>
                                <p className='text-gray-500 text-sm mt-1'>Manage customer property search requests</p>
                            </div>

                            {loading ? (
                                <div className='text-center py-12'>
                                    <div className='inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600'></div>
                                    <p className='text-gray-500 mt-4'>Loading orders...</p>
                                </div>
                            ) : orders.filter(order =>
                                !searchQuery ||
                                order.users?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                order.users?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                order.division?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                order.district?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                order.area?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                order.id?.toString().includes(searchQuery)
                            ).length === 0 ? (
                                <div className='bg-white rounded-lg shadow p-12 text-center'>
                                    <BiPackage className='text-6xl text-gray-300 mx-auto mb-4' />
                                    <h3 className='text-lg font-medium text-gray-900 mb-2'>No orders found</h3>
                                    <p className='text-gray-500'>Orders will appear here once customers submit property requirements</p>
                                </div>
                            ) : (
                                <div className='grid grid-cols-1 lg:grid-cols-2 gap-6'>
                                    {orders.filter(order =>
                                        !searchQuery ||
                                        order.users?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        order.users?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        order.division?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        order.district?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        order.area?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        order.id?.toString().includes(searchQuery)
                                    ).map((order) => (
                                        <div key={order.id} className='bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow'>
                                            {/* Header with Status */}
                                            <div className='flex justify-between items-start mb-4'>
                                                <div>
                                                    <p className='text-xs text-gray-500'>Order ID</p>
                                                    <p className='font-mono text-sm text-gray-700'>#{order.id?.slice(0, 8)}</p>
                                                </div>
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                                                    order.status === 'confirmed' ? 'bg-green-100 text-green-800' :
                                                    order.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                                    order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                    'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {order.status || 'pending_payment'}
                                                </span>
                                            </div>

                                            {/* Customer Info */}
                                            <div className='bg-gray-50 rounded-lg p-3 mb-4'>
                                                <p className='text-xs text-gray-500 mb-1'>Customer</p>
                                                <p className='font-semibold text-gray-800'>{order.users?.name || 'Unknown'}</p>
                                                <p className='text-sm text-gray-600'>{order.users?.email || 'No email'}</p>
                                            </div>

                                            {/* Location Details */}
                                            <div className='grid grid-cols-2 gap-3 mb-4'>
                                                <div>
                                                    <p className='text-xs text-gray-500'>Division</p>
                                                    <p className='text-sm font-medium text-gray-800'>{order.division || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className='text-xs text-gray-500'>District</p>
                                                    <p className='text-sm font-medium text-gray-800'>{order.district || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className='text-xs text-gray-500'>Area</p>
                                                    <p className='text-sm font-medium text-gray-800'>{order.area || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className='text-xs text-gray-500'>Sub Area</p>
                                                    <p className='text-sm font-medium text-gray-800'>{order.sub_area || 'N/A'}</p>
                                                </div>
                                            </div>

                                            {/* Property Requirements */}
                                            <div className='grid grid-cols-3 gap-3 mb-4'>
                                                <div className='bg-primary-50 rounded-lg p-2 text-center'>
                                                    <p className='text-xs text-primary-600'>Category</p>
                                                    <p className='text-sm font-bold text-primary-800'>{order.category || 'N/A'}</p>
                                                </div>
                                                <div className='bg-green-50 rounded-lg p-2 text-center'>
                                                    <p className='text-xs text-green-600'>Rooms</p>
                                                    <p className='text-sm font-bold text-green-800'>{order.rooms || 'N/A'}</p>
                                                </div>
                                                <div className='bg-orange-50 rounded-lg p-2 text-center'>
                                                    <p className='text-xs text-orange-600'>Max Budget</p>
                                                    <p className='text-sm font-bold text-orange-800'>{order.max_budget ? `৳${order.max_budget}` : 'N/A'}</p>
                                                </div>
                                            </div>

                                            {/* Need From & Package */}
                                            <div className='grid grid-cols-2 gap-3 mb-4'>
                                                <div>
                                                    <p className='text-xs text-gray-500'>Property Need From</p>
                                                    <p className='text-sm font-medium text-gray-800'>{formatOrderNeedFrom(order.property_need_from) || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className='text-xs text-gray-500'>Package / Cost</p>
                                                    <p className='text-sm font-medium text-gray-800'>{order.package || '7_days'} - ৳{order.cost || 1000}</p>
                                                </div>
                                            </div>

                                            {/* Additional Preferences */}
                                            {order.additional_preferences && (
                                                <div className='bg-blue-50 rounded-lg p-3 mb-4'>
                                                    <p className='text-xs text-blue-600 mb-1'>Additional Preferences</p>
                                                    <p className='text-sm text-gray-700'>{formatOrderPreferencesSummary(order.additional_preferences)}</p>
                                                </div>
                                            )}

                                            {/* Order Date */}
                                            <div className='text-xs text-gray-400 mb-4'>
                                                Ordered: {order.created_at ? new Date(order.created_at).toLocaleString() : 'N/A'}
                                            </div>

                                            {!canOrderBePostedToJobFeed(order) && (
                                                <div className='mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800'>
                                                    {order.is_job_feed_posted
                                                        ? 'This order is marked as posted, but it stays hidden from the public job feed until the status is confirmed.'
                                                        : 'This order must be confirmed before it can be posted to the homepage job feed.'}
                                                </div>
                                            )}

                                            <div className='mb-4 rounded-xl border border-dashed border-[#1E73B8]/30 bg-[#1E73B8]/5 p-4'>
                                                <div className='flex items-center justify-between gap-3'>
                                                    <p className='text-xs font-semibold uppercase tracking-[0.18em] text-[#1E73B8]'>
                                                        Homepage Job Feed
                                                    </p>
                                                    <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${
                                                        order.is_job_feed_posted
                                                            ? 'bg-green-100 text-green-800'
                                                            : 'bg-gray-200 text-gray-700'
                                                    }`}>
                                                        {order.is_job_feed_posted ? 'Posted' : 'Not Posted'}
                                                    </span>
                                                </div>
                                                <p className='mt-3 text-sm font-semibold text-gray-900'>
                                                    {order.job_feed_title || buildOrderJobFeedFallbackTitle(order)}
                                                </p>
                                                <p className='mt-2 text-sm text-gray-600'>
                                                    {order.job_feed_description || buildOrderJobFeedFallbackDescription(order)}
                                                </p>
                                                {order.job_feed_posted_at && (
                                                    <p className='mt-2 text-xs text-gray-500'>
                                                        Homepage posted at {new Date(order.job_feed_posted_at).toLocaleString()}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Actions */}
                                            <div className='flex flex-wrap gap-2 items-center border-t pt-4'>
                                                <select
                                                    value={order.status || 'pending_payment'}
                                                    onChange={(e) => handleOrderStatusChange(order.id, e.target.value)}
                                                    className='min-w-[190px] flex-1 text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500'
                                                >
                                                    <option value='pending_payment'>Pending Payment</option>
                                                    <option value='confirmed'>Confirmed</option>
                                                    <option value='processing'>Processing</option>
                                                    <option value='completed'>Completed</option>
                                                    <option value='cancelled'>Cancelled</option>
                                                </select>
                                                <button
                                                    onClick={() => handleOpenJobFeedModal(order)}
                                                    className='bg-blue-50 text-blue-700 px-4 py-2 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium'
                                                >
                                                    Edit Job Feed
                                                </button>
                                                <button
                                                    onClick={() => handleToggleOrderJobFeed(order)}
                                                    disabled={!order.is_job_feed_posted && !canOrderBePostedToJobFeed(order)}
                                                    className={`px-4 py-2 rounded-lg transition-colors text-sm font-medium ${
                                                        order.is_job_feed_posted
                                                            ? 'bg-amber-50 text-amber-700 hover:bg-amber-100'
                                                            : 'bg-green-50 text-green-700 hover:bg-green-100 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400'
                                                    }`}
                                                >
                                                    {order.is_job_feed_posted ? 'Unpost Job' : 'Post Job'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteOrder(order.id)}
                                                    className='bg-red-50 text-red-600 px-4 py-2 rounded-lg hover:bg-red-100 transition-colors'
                                                >
                                                    <MdDelete className='text-lg' />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* INQUIRIES SECTION */}
                    {activeMenu === 'inquiries' && (
                        <div className='space-y-6'>
                            <div>
                                <h2 className='text-xl font-semibold text-black'>Property Inquiries</h2>
                                <p className='text-gray-500 text-sm mt-1'>View and manage contact inquiries from potential buyers/renters</p>
                            </div>

                            {loading ? (
                                <div className='text-center py-12'>
                                    <div className='inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600'></div>
                                    <p className='text-gray-500 mt-4'>Loading inquiries...</p>
                                </div>
                            ) : inquiries.filter(inquiry =>
                                !searchQuery ||
                                inquiry.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                inquiry.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                inquiry.phone?.includes(searchQuery) ||
                                inquiry.message?.toLowerCase().includes(searchQuery.toLowerCase())
                            ).length === 0 ? (
                                <div className='bg-white rounded-lg shadow p-12 text-center'>
                                    <BiEnvelope className='text-6xl text-gray-300 mx-auto mb-4' />
                                    <h3 className='text-lg font-medium text-gray-900 mb-2'>No inquiries yet</h3>
                                    <p className='text-gray-500'>Property inquiries will appear here when users submit contact forms</p>
                                </div>
                            ) : (
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                                    {inquiries.filter(inquiry =>
                                        !searchQuery ||
                                        inquiry.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        inquiry.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        inquiry.phone?.includes(searchQuery) ||
                                        inquiry.message?.toLowerCase().includes(searchQuery.toLowerCase())
                                    ).map((inquiry) => (
                                        <div key={inquiry.id} className='bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow'>
                                            <div className='flex justify-between items-start mb-4'>
                                                <div>
                                                    <h3 className='font-semibold text-gray-900'>{inquiry.name}</h3>
                                                    <p className='text-sm text-gray-600 mt-1'>{inquiry.email}</p>
                                                    <p className='text-sm text-gray-600'>{inquiry.phone}</p>
                                                    <p className='text-xs text-gray-400 mt-1'>
                                                        {new Date(inquiry.created_at).toLocaleDateString()} at {new Date(inquiry.created_at).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                    inquiry.status === 'responded' ? 'bg-green-100 text-green-800' :
                                                    inquiry.status === 'read' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-yellow-100 text-yellow-800'
                                                }`}>
                                                    {inquiry.status === 'responded' ? 'Responded' :
                                                     inquiry.status === 'read' ? 'Read' :
                                                     'Pending'}
                                                </span>
                                            </div>

                                            {/* Property Info */}
                                            {inquiry.properties && (
                                                <div className='bg-gray-50 rounded-lg p-3 mb-4'>
                                                    <p className='text-xs text-gray-500 mb-1'>Property:</p>
                                                    <p className='text-sm font-medium text-gray-800'>
                                                        {inquiry.properties.property_type || 'N/A'} - {inquiry.properties.state_district}, {inquiry.properties.area}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Message */}
                                            <div className='bg-primary-50 rounded-lg p-3 mb-4'>
                                                <p className='text-xs text-gray-500 mb-1'>Message:</p>
                                                <p className='text-sm text-gray-700'>{inquiry.message}</p>
                                            </div>

                                            {/* Actions */}
                                            <div className='flex gap-2 flex-wrap'>
                                                {inquiry.status === 'pending' && (
                                                    <button
                                                        onClick={() => handleInquiryStatusChange(inquiry.id, 'read')}
                                                        className='flex-1 bg-blue-50 text-blue-700 px-4 py-2 rounded hover:bg-blue-100 transition-colors text-sm font-medium'
                                                    >
                                                        Mark as Read
                                                    </button>
                                                )}
                                                {(inquiry.status === 'pending' || inquiry.status === 'read') && (
                                                    <button
                                                        onClick={() => handleInquiryStatusChange(inquiry.id, 'responded')}
                                                        className='flex-1 bg-green-50 text-green-700 px-4 py-2 rounded hover:bg-green-100 transition-colors text-sm font-medium'
                                                    >
                                                        Mark as Responded
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleDeleteInquiry(inquiry.id)}
                                                    className='bg-red-50 text-red-600 px-4 py-2 rounded hover:bg-red-100 transition-colors text-sm'
                                                >
                                                    <MdDelete className='text-lg' />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeMenu === 'search-history' && (
                        <SearchHistoryManagement />
                    )}

                    {/* FEEDBACK SECTION */}
                    {activeMenu === 'feedback' && (
                        <div className='space-y-6'>
                            <div>
                                <h2 className='text-xl font-semibold text-black'>User Feedback Control</h2>
                                <p className='text-gray-500 text-sm mt-1'>View and manage customer feedback</p>
                            </div>

                            {loading ? (
                                <div className='text-center py-12'>
                                    <div className='inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600'></div>
                                    <p className='text-gray-500 mt-4'>Loading feedback...</p>
                                </div>
                            ) : feedbacks.filter(feedback =>
                                !searchQuery ||
                                feedback.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                feedback.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                feedback.feedback?.toLowerCase().includes(searchQuery.toLowerCase())
                            ).length === 0 ? (
                                <div className='bg-white rounded-lg shadow p-12 text-center'>
                                    <MdFeedback className='text-6xl text-gray-300 mx-auto mb-4' />
                                    <h3 className='text-lg font-medium text-gray-900 mb-2'>No feedback yet</h3>
                                    <p className='text-gray-500'>User feedback will appear here</p>
                                </div>
                            ) : (
                                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                                    {feedbacks.filter(feedback =>
                                        !searchQuery ||
                                        feedback.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        feedback.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                        feedback.feedback?.toLowerCase().includes(searchQuery.toLowerCase())
                                    ).map((feedback) => (
                                        <div key={feedback.id} className='bg-white rounded-lg shadow p-6 hover:shadow-lg transition-shadow'>
                                            <div className='flex justify-between items-start mb-4'>
                                                <div>
                                                    <h3 className='font-semibold text-gray-900'>{feedback.name}</h3>
                                                    <p className='text-xs text-gray-500 mt-1'>
                                                        {feedback.email}
                                                    </p>
                                                    <p className='text-xs text-gray-400 mt-1'>
                                                        {new Date(feedback.created_at).toLocaleDateString()}
                                                    </p>
                                                </div>
                                                <div className='flex flex-col gap-1 items-end'>
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                                                        feedback.status === 'approved' ? 'bg-green-100 text-green-800' :
                                                        feedback.status === 'rejected' ? 'bg-red-100 text-red-800' :
                                                        'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                        {feedback.status === 'approved' ? 'Approved' :
                                                         feedback.status === 'rejected' ? 'Rejected' :
                                                         'Pending'}
                                                    </span>
                                                    {feedback.is_resolved && (
                                                        <span className='px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800'>
                                                            Resolved
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <p className='text-gray-700 mb-4'>{feedback.feedback}</p>
                                            <div className='flex gap-2 flex-wrap'>
                                                {feedback.status === 'pending' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleApproveFeedback(feedback.id)}
                                                            className='flex-1 bg-green-50 text-green-700 px-4 py-2 rounded hover:bg-green-100 transition-colors text-sm font-medium flex items-center justify-center gap-1'
                                                        >
                                                            <MdCheckCircle />
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleRejectFeedback(feedback.id)}
                                                            className='flex-1 bg-red-50 text-red-700 px-4 py-2 rounded hover:bg-red-100 transition-colors text-sm font-medium flex items-center justify-center gap-1'
                                                        >
                                                            <MdCancel />
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                                {feedback.status === 'approved' && (
                                                    <button
                                                        onClick={() => handleRejectFeedback(feedback.id)}
                                                        className='flex-1 bg-red-50 text-red-700 px-4 py-2 rounded hover:bg-red-100 transition-colors text-sm font-medium'
                                                    >
                                                        Reject & Hide
                                                    </button>
                                                )}
                                                {feedback.status === 'rejected' && (
                                                    <button
                                                        onClick={() => handleApproveFeedback(feedback.id)}
                                                        className='flex-1 bg-green-50 text-green-700 px-4 py-2 rounded hover:bg-green-100 transition-colors text-sm font-medium'
                                                    >
                                                        Approve & Show
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleToggleFeedbackStatus(feedback.id, feedback.is_resolved)}
                                                    className='flex-1 bg-blue-50 text-blue-600 px-4 py-2 rounded hover:bg-blue-100 transition-colors text-sm'
                                                >
                                                    {feedback.is_resolved ? 'Unresolve' : 'Mark Resolved'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteFeedback(feedback.id)}
                                                    className='bg-red-50 text-red-600 px-4 py-2 rounded hover:bg-red-100 transition-colors text-sm'
                                                    title='Delete'
                                                >
                                                    <MdDelete />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </main>

            {/* Add Photo Modal */}
            {showAddModal && (
                <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
                    <div className='bg-white rounded-lg max-w-md w-full p-6'>
                        <div className='flex justify-between items-center mb-4'>
                            <h3 className='text-xl font-semibold'>Add New Cover Photo</h3>
                            <button onClick={resetUploadForm} className='text-2xl text-gray-400 hover:text-gray-600'>
                                <RxCross2 />
                            </button>
                        </div>

                        {/* Upload Mode Toggle */}
                        <div className='flex gap-2 mb-4'>
                            <button
                                onClick={() => setUploadMode('file')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition font-medium ${
                                    uploadMode === 'file'
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                <FiImageIcon size={18} />
                                Upload File
                            </button>
                            <button
                                onClick={() => setUploadMode('url')}
                                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition font-medium ${
                                    uploadMode === 'url'
                                        ? 'bg-primary-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                <FiLink size={18} />
                                Image URL
                            </button>
                        </div>

                        <div className='space-y-4'>
                            {/* File Upload Mode */}
                            {uploadMode === 'file' && (
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                                        Select Image File
                                    </label>
                                    <div className='mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg'>
                                        <p className='text-sm text-blue-800'>
                                            <strong>📏 Minimum size:</strong> 1200x360 pixels
                                        </p>
                                        <p className='text-sm text-blue-800 mt-1'>
                                            <strong>✨ Auto-optimization:</strong> Images will be automatically resized and compressed to WebP format for faster loading
                                        </p>
                                    </div>
                                    <div
                                        className='border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-500 transition cursor-pointer'
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type='file'
                                            accept='image/*'
                                            onChange={handleFileSelect}
                                            className='hidden'
                                        />
                                        {selectedFile ? (
                                            <div className='space-y-2'>
                                                <FiImageIcon className='mx-auto text-primary-600' size={40} />
                                                <p className='text-sm font-medium text-gray-900'>{selectedFile.name}</p>
                                                <p className='text-xs text-gray-500'>
                                                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                                </p>
                                                <button
                                                    type='button'
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setSelectedFile(null);
                                                        setFilePreview(null);
                                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                                    }}
                                                    className='text-red-600 text-sm hover:text-red-700'
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        ) : (
                                            <div className='space-y-2'>
                                                <FiUpload className='mx-auto text-gray-400' size={40} />
                                                <p className='text-sm text-gray-600'>
                                                    Click to select an image
                                                </p>
                                                <p className='text-xs text-gray-500'>
                                                    PNG, JPG, WEBP up to 5MB
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* URL Input Mode */}
                            {uploadMode === 'url' && (
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 mb-2'>
                                        Image URL
                                    </label>
                                    <div className='mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg'>
                                        <p className='text-sm text-yellow-800'>
                                            <strong>⚠️ Note:</strong> Direct URLs are not automatically optimized. For best performance, use file upload instead.
                                        </p>
                                        <p className='text-sm text-yellow-800 mt-1'>
                                            Recommended minimum size: 1200x360 pixels
                                        </p>
                                    </div>
                                    <input
                                        type='text'
                                        value={newPhotoUrl}
                                        onChange={(e) => setNewPhotoUrl(e.target.value)}
                                        placeholder='https://example.com/image.jpg'
                                        className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
                                    />
                                </div>
                            )}

                            {/* Preview */}
                            {(filePreview || newPhotoUrl) && (
                                <div className='border rounded-lg p-2'>
                                    <p className='text-xs text-gray-500 mb-2'>Preview:</p>
                                    <img
                                        src={uploadMode === 'file' ? filePreview : newPhotoUrl}
                                        alt='Preview'
                                        className='w-full h-40 object-cover rounded'
                                        onError={(e) => {
                                            e.target.src = 'https://via.placeholder.com/400x300?text=Invalid+URL';
                                        }}
                                    />
                                </div>
                            )}

                            <div className='flex gap-2'>
                                <button
                                    onClick={handleAddPhoto}
                                    disabled={uploading}
                                    className='flex-1 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2'
                                >
                                    {uploading ? (
                                        <>
                                            <div className='animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent'></div>
                                            {uploadMode === 'file' ? 'Uploading...' : 'Adding...'}
                                        </>
                                    ) : (
                                        <>
                                            <FiUpload size={16} />
                                            Add Photo
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={resetUploadForm}
                                    disabled={uploading}
                                    className='flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50'
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Photo Modal */}
            {showEditModal && editingPhoto && (
                <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
                    <div className='bg-white rounded-lg max-w-md w-full p-6'>
                        <div className='flex justify-between items-center mb-4'>
                            <h3 className='text-xl font-semibold'>Edit Cover Photo</h3>
                            <button onClick={() => setShowEditModal(false)} className='text-2xl text-gray-400 hover:text-gray-600'>
                                <RxCross2 />
                            </button>
                        </div>
                        <div className='space-y-4'>
                            <div>
                                <label className='block text-sm font-medium text-gray-700 mb-2'>
                                    Image URL
                                </label>
                                <input
                                    type='text'
                                    value={editingPhoto.image_url}
                                    onChange={(e) => setEditingPhoto({ ...editingPhoto, image_url: e.target.value })}
                                    placeholder='https://example.com/image.jpg'
                                    className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
                                />
                            </div>
                            {editingPhoto.image_url && (
                                <div className='border rounded-lg p-2'>
                                    <p className='text-xs text-gray-500 mb-2'>Preview:</p>
                                    <img
                                        src={editingPhoto.image_url}
                                        alt='Preview'
                                        className='w-full h-40 object-cover rounded'
                                        onError={(e) => {
                                            e.target.src = 'https://via.placeholder.com/400x300?text=Invalid+URL';
                                        }}
                                    />
                                </div>
                            )}
                            <div className='flex gap-2'>
                                <button
                                    onClick={handleUpdatePhoto}
                                    className='flex-1 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors'
                                >
                                    Save Changes
                                </button>
                                <button
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setEditingPhoto(null);
                                    }}
                                    className='flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors'
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Package Modal */}
            {showAddPackageModal && (
                <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
                    <div className='bg-white rounded-lg max-w-md w-full p-6'>
                        <div className='flex justify-between items-center mb-4'>
                            <h3 className='text-xl font-semibold'>Add New Credit Package</h3>
                            <button onClick={() => setShowAddPackageModal(false)} className='text-2xl text-gray-400 hover:text-gray-600'>
                                <RxCross2 />
                            </button>
                        </div>
                        <div className='space-y-4'>
                            <div>
                                <label className='block text-sm font-medium text-gray-700 mb-2'>Package Name</label>
                                <input
                                    type='text'
                                    value={newPackage.name}
                                    onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                                    placeholder='e.g., Premium'
                                    className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
                                />
                            </div>
                            <div className='grid grid-cols-2 gap-4'>
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 mb-2'>Credits</label>
                                    <input
                                        type='number'
                                        value={newPackage.credits}
                                        onChange={(e) => setNewPackage({ ...newPackage, credits: parseInt(e.target.value) || 0 })}
                                        min='1'
                                        className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
                                    />
                                </div>
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 mb-2'>Price (৳)</label>
                                    <input
                                        type='number'
                                        value={newPackage.price}
                                        onChange={(e) => setNewPackage({ ...newPackage, price: parseInt(e.target.value) || 0 })}
                                        min='1'
                                        className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
                                    />
                                </div>
                            </div>
                            <div>
                                <label className='block text-sm font-medium text-gray-700 mb-2'>Discount (%)</label>
                                <input
                                    type='number'
                                    value={newPackage.discount}
                                    onChange={(e) => setNewPackage({ ...newPackage, discount: parseInt(e.target.value) || 0 })}
                                    min='0'
                                    max='100'
                                    className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
                                />
                            </div>
                            <div className='flex items-center gap-2'>
                                <input
                                    type='checkbox'
                                    id='popularNew'
                                    checked={newPackage.popular}
                                    onChange={(e) => setNewPackage({ ...newPackage, popular: e.target.checked })}
                                    className='w-4 h-4 text-primary-600 rounded'
                                />
                                <label htmlFor='popularNew' className='text-sm text-gray-700'>Mark as Popular</label>
                            </div>
                            <div className='flex gap-2'>
                                <button
                                    onClick={handleAddPackage}
                                    className='flex-1 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors'
                                >
                                    Add Package
                                </button>
                                <button
                                    onClick={() => setShowAddPackageModal(false)}
                                    className='flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors'
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Package Modal */}
            {showEditPackageModal && editingPackage && (
                <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
                    <div className='bg-white rounded-lg max-w-md w-full p-6'>
                        <div className='flex justify-between items-center mb-4'>
                            <h3 className='text-xl font-semibold'>Edit Credit Package</h3>
                            <button onClick={() => setShowEditPackageModal(false)} className='text-2xl text-gray-400 hover:text-gray-600'>
                                <RxCross2 />
                            </button>
                        </div>
                        <div className='space-y-4'>
                            <div>
                                <label className='block text-sm font-medium text-gray-700 mb-2'>Package Name</label>
                                <input
                                    type='text'
                                    value={editingPackage.name}
                                    onChange={(e) => setEditingPackage({ ...editingPackage, name: e.target.value })}
                                    className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
                                />
                            </div>
                            <div className='grid grid-cols-2 gap-4'>
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 mb-2'>Credits</label>
                                    <input
                                        type='number'
                                        value={editingPackage.credits}
                                        onChange={(e) => setEditingPackage({ ...editingPackage, credits: parseInt(e.target.value) || 0 })}
                                        min='1'
                                        className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
                                    />
                                </div>
                                <div>
                                    <label className='block text-sm font-medium text-gray-700 mb-2'>Price (৳)</label>
                                    <input
                                        type='number'
                                        value={editingPackage.price}
                                        onChange={(e) => setEditingPackage({ ...editingPackage, price: parseInt(e.target.value) || 0 })}
                                        min='1'
                                        className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
                                    />
                                </div>
                            </div>
                            <div>
                                <label className='block text-sm font-medium text-gray-700 mb-2'>Discount (%)</label>
                                <input
                                    type='number'
                                    value={editingPackage.discount}
                                    onChange={(e) => setEditingPackage({ ...editingPackage, discount: parseInt(e.target.value) || 0 })}
                                    min='0'
                                    max='100'
                                    className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
                                />
                            </div>
                            <div className='flex items-center gap-2'>
                                <input
                                    type='checkbox'
                                    id='popularEdit'
                                    checked={editingPackage.popular}
                                    onChange={(e) => setEditingPackage({ ...editingPackage, popular: e.target.checked })}
                                    className='w-4 h-4 text-primary-600 rounded'
                                />
                                <label htmlFor='popularEdit' className='text-sm text-gray-700'>Mark as Popular</label>
                            </div>
                            <div className='flex gap-2'>
                                <button
                                    onClick={handleUpdatePackage}
                                    className='flex-1 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors'
                                >
                                    Save Changes
                                </button>
                                <button
                                    onClick={() => setShowEditPackageModal(false)}
                                    className='flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors'
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* User Credit Modification Modal */}
            {showCreditModal && selectedUserForCredit && (
                <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
                    <div className='bg-white rounded-lg max-w-md w-full p-6'>
                        <div className='flex justify-between items-center mb-4'>
                            <h3 className='text-xl font-semibold'>Modify User Credits</h3>
                            <button onClick={() => setShowCreditModal(false)} className='text-2xl text-gray-400 hover:text-gray-600'>
                                <RxCross2 />
                            </button>
                        </div>
                        <div className='space-y-4'>
                            <div className='bg-gray-50 rounded-lg p-4'>
                                <p className='text-sm text-gray-600'>User: <span className='font-semibold text-gray-900'>{selectedUserForCredit.name || 'Unknown'}</span></p>
                                <p className='text-sm text-gray-600'>Email: <span className='font-medium'>{selectedUserForCredit.email}</span></p>
                                <p className='text-sm text-gray-600'>Current Credits: <span className='font-bold text-primary-600'>{selectedUserForCredit.credits || 0}</span></p>
                            </div>
                            <div>
                                <label className='block text-sm font-medium text-gray-700 mb-2'>Action</label>
                                <select
                                    value={creditAction}
                                    onChange={(e) => setCreditAction(e.target.value)}
                                    className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
                                >
                                    <option value='add'>Add Credits</option>
                                    <option value='subtract'>Subtract Credits</option>
                                    <option value='set'>Set Credits</option>
                                </select>
                            </div>
                            <div>
                                <label className='block text-sm font-medium text-gray-700 mb-2'>Amount</label>
                                <input
                                    type='number'
                                    value={creditAmount}
                                    onChange={(e) => setCreditAmount(parseInt(e.target.value) || 0)}
                                    min='0'
                                    className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500'
                                />
                            </div>
                            {creditAction !== 'set' && creditAmount > 0 && (
                                <p className='text-sm text-gray-600'>
                                    New balance will be: <span className='font-bold text-primary-600'>
                                        {creditAction === 'add'
                                            ? (selectedUserForCredit.credits || 0) + creditAmount
                                            : Math.max(0, (selectedUserForCredit.credits || 0) - creditAmount)
                                        }
                                    </span>
                                </p>
                            )}
                            <div className='flex gap-2'>
                                <button
                                    onClick={handleUpdateUserCredits}
                                    className='flex-1 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 transition-colors'
                                >
                                    Apply Changes
                                </button>
                                <button
                                    onClick={() => setShowCreditModal(false)}
                                    className='flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors'
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showJobFeedModal && editingJobFeedOrder && (
                <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
                    <div className='bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl'>
                        <div className='flex justify-between items-start gap-4 mb-6'>
                            <div>
                                <h3 className='text-2xl font-semibold text-gray-900'>Edit Homepage Job Feed</h3>
                                <p className='text-sm text-gray-500 mt-1'>
                                    Control how this ordered-home request appears above Recently Published Properties.
                                </p>
                            </div>
                            <button
                                onClick={handleCloseJobFeedModal}
                                className='text-2xl text-gray-400 hover:text-gray-600'
                            >
                                <RxCross2 />
                            </button>
                        </div>

                        <div className='space-y-5'>
                            <div className='rounded-xl bg-gray-50 p-4'>
                                <p className='text-xs font-semibold uppercase tracking-[0.18em] text-gray-500'>Source Order</p>
                                <p className='mt-2 text-sm font-medium text-gray-800'>
                                    {buildOrderJobFeedFallbackTitle(editingJobFeedOrder)}
                                </p>
                                <p className='mt-1 text-sm text-gray-600'>
                                    {buildOrderJobFeedFallbackDescription(editingJobFeedOrder)}
                                </p>
                            </div>

                            <div>
                                <label className='block text-sm font-medium text-gray-700 mb-2'>Public Job Title</label>
                                <input
                                    type='text'
                                    value={jobFeedDraft.title}
                                    onChange={(e) => setJobFeedDraft({ ...jobFeedDraft, title: e.target.value })}
                                    placeholder={buildOrderJobFeedFallbackTitle(editingJobFeedOrder)}
                                    className='w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500'
                                />
                            </div>

                            <div>
                                <label className='block text-sm font-medium text-gray-700 mb-2'>Public Job Description</label>
                                <textarea
                                    rows='5'
                                    value={jobFeedDraft.description}
                                    onChange={(e) => setJobFeedDraft({ ...jobFeedDraft, description: e.target.value })}
                                    placeholder={buildOrderJobFeedFallbackDescription(editingJobFeedOrder)}
                                    className='w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none'
                                />
                            </div>

                            <label className='flex items-center gap-3 rounded-xl border border-gray-200 p-4'>
                                <input
                                    type='checkbox'
                                    checked={jobFeedDraft.isPosted}
                                    onChange={(e) => setJobFeedDraft({ ...jobFeedDraft, isPosted: e.target.checked })}
                                    disabled={!canOrderBePostedToJobFeed(editingJobFeedOrder) && !editingJobFeedOrder.is_job_feed_posted}
                                    className='w-4 h-4 text-primary-600 rounded'
                                />
                                <div>
                                    <p className='text-sm font-semibold text-gray-800'>Post this job to homepage</p>
                                    <p className='text-xs text-gray-500 mt-1'>
                                        Posted jobs appear publicly in the homepage Job Feed section.
                                    </p>
                                    {!canOrderBePostedToJobFeed(editingJobFeedOrder) && (
                                        <p className='mt-1 text-xs text-amber-700'>
                                            {editingJobFeedOrder.is_job_feed_posted
                                                ? 'This order is currently hidden from the public feed until its status becomes confirmed again.'
                                                : 'This order must be confirmed before it can be posted.'}
                                        </p>
                                    )}
                                </div>
                            </label>

                            <div className='flex flex-wrap gap-3 pt-2'>
                                <button
                                    onClick={() => handleSaveOrderJobFeed(jobFeedDraft.isPosted)}
                                    disabled={jobFeedSaving}
                                    className='bg-primary-500 text-white px-5 py-3 rounded-xl hover:bg-primary-600 transition-colors font-medium disabled:opacity-60'
                                >
                                    {jobFeedSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                                {editingJobFeedOrder.is_job_feed_posted && (
                                    <button
                                        onClick={() => handleSaveOrderJobFeed(false)}
                                        disabled={jobFeedSaving}
                                        className='bg-amber-50 text-amber-700 px-5 py-3 rounded-xl hover:bg-amber-100 transition-colors font-medium disabled:opacity-60'
                                    >
                                        Unpost from Homepage
                                    </button>
                                )}
                                <button
                                    onClick={handleCloseJobFeedModal}
                                    disabled={jobFeedSaving}
                                    className='bg-gray-200 text-gray-800 px-5 py-3 rounded-xl hover:bg-gray-300 transition-colors font-medium disabled:opacity-60'
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Admin;
