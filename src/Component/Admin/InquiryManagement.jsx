import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiMail, FiPhone, FiUser, FiMapPin, FiClock, FiTrash2, FiCheck, FiMessageSquare, FiUsers, FiSearch } from 'react-icons/fi';
import { getAllInquiries, updateInquiryStatus, deleteInquiry } from '../../services/inquiryService';
import { getDashboardStats } from '../../services/adminService';

const InquiryManagement = () => {
    const [inquiries, setInquiries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [updating, setUpdating] = useState(null);
    const [totalUsers, setTotalUsers] = useState(0);
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;

        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const fetchUserStats = useCallback(async () => {
        const result = await getDashboardStats();
        if (isMountedRef.current && result.data) {
            setTotalUsers(result.data.totalUsers || 0);
        }
    }, []);

    const fetchInquiries = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await getAllInquiries();
            if (error) throw error;
            if (isMountedRef.current) {
                setInquiries(data || []);
            }
        } catch (err) {
            console.error('Error fetching inquiries:', err);
            if (isMountedRef.current) {
                setError('Failed to load inquiries');
            }
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, []);

    useEffect(() => {
        void fetchInquiries();
        void fetchUserStats();
    }, [fetchInquiries, fetchUserStats]);

    const filteredInquiries = useMemo(() => {
        let filtered = inquiries;

        if (filter !== 'all') {
            filtered = filtered.filter((i) => i.status === filter);
        }

        if (searchTerm) {
            const normalizedSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (i) =>
                    i.name?.toLowerCase().includes(normalizedSearch) ||
                    i.email?.toLowerCase().includes(normalizedSearch) ||
                    i.phone?.includes(searchTerm) ||
                    i.message?.toLowerCase().includes(normalizedSearch)
            );
        }

        return filtered;
    }, [filter, inquiries, searchTerm]);

    const handleSearch = (value) => {
        setSearchTerm(value);
    };

    const handleStatusChange = async (inquiryId, newStatus) => {
        setUpdating(inquiryId);
        try {
            const { error } = await updateInquiryStatus(inquiryId, newStatus);
            if (error) throw error;
            setInquiries(prev =>
                prev.map(inq =>
                    inq.id === inquiryId ? { ...inq, status: newStatus } : inq
                )
            );
        } catch (err) {
            console.error('Error updating status:', err);
            alert('Failed to update status');
        } finally {
            setUpdating(null);
        }
    };

    const handleDelete = async (inquiryId) => {
        try {
            const { error } = await deleteInquiry(inquiryId);
            if (error) throw error;
            setInquiries(prev => prev.filter(inq => inq.id !== inquiryId));
            setDeleteConfirm(null);
        } catch (err) {
            console.error('Error deleting inquiry:', err);
            alert('Failed to delete inquiry');
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            pending: 'bg-yellow-100 text-yellow-800',
            contacted: 'bg-blue-100 text-blue-800',
            resolved: 'bg-green-100 text-green-800',
            closed: 'bg-gray-100 text-gray-800'
        };
        return (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status] || styles.pending}`}>
                {status?.charAt(0).toUpperCase() + status?.slice(1) || 'Pending'}
            </span>
        );
    };

    const stats = {
        total: inquiries.length,
        pending: inquiries.filter(i => i.status === 'pending').length,
        contacted: inquiries.filter(i => i.status === 'contacted').length,
        resolved: inquiries.filter(i => i.status === 'resolved').length
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center py-20">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <p className="text-red-800 font-semibold">{error}</p>
                <button
                    onClick={fetchInquiries}
                    className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Total Users Badge */}
            <div className="flex items-center justify-end">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-5 py-3 rounded-xl shadow-lg flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                        <FiUsers className="text-white text-xl" />
                    </div>
                    <div>
                        <p className="text-gray-900 text-xs font-medium uppercase tracking-wide">Total Users</p>
                        <p className="text-xl font-bold text-white leading-tight">{totalUsers}</p>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-gray-600 text-sm">Total Inquiries</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="bg-yellow-50 rounded-lg shadow p-4">
                    <p className="text-yellow-700 text-sm">Pending</p>
                    <p className="text-2xl font-bold text-yellow-800">{stats.pending}</p>
                </div>
                <div className="bg-blue-50 rounded-lg shadow p-4">
                    <p className="text-blue-700 text-sm">Contacted</p>
                    <p className="text-2xl font-bold text-blue-800">{stats.contacted}</p>
                </div>
                <div className="bg-green-50 rounded-lg shadow p-4">
                    <p className="text-green-700 text-sm">Resolved</p>
                    <p className="text-2xl font-bold text-green-800">{stats.resolved}</p>
                </div>
            </div>

            {/* Controls */}
            <div className="bg-white rounded-lg shadow p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Search */}
                    <div className="relative">
                        <FiSearch className="absolute left-3 top-3 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name, email, phone..."
                            value={searchTerm}
                            onChange={(e) => handleSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                        />
                    </div>

                    {/* Status Filter */}
                    <div className="flex items-center gap-2">
                        <select
                            value={filter}
                            onChange={(e) => {
                                setFilter(e.target.value);
                            }}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                        >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="contacted">Contacted</option>
                            <option value="resolved">Resolved</option>
                            <option value="closed">Closed</option>
                        </select>
                    </div>

                    {/* Refresh Button */}
                    <button
                        onClick={fetchInquiries}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {/* Inquiries List */}
            {filteredInquiries.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                    <FiMessageSquare className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">No Inquiries</h3>
                    <p className="text-gray-500">
                        {filter === 'all'
                            ? 'No inquiries have been submitted yet.'
                            : `No ${filter} inquiries found.`}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredInquiries.map(inquiry => (
                        <div key={inquiry.id} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
                            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                                {/* Inquiry Info */}
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                            <FiUser className="text-gray-500" />
                                            {inquiry.name}
                                        </h3>
                                        {getStatusBadge(inquiry.status)}
                                    </div>

                                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                        <a href={`mailto:${inquiry.email}`} className="flex items-center gap-1 hover:text-primary-600">
                                            <FiMail className="w-4 h-4" />
                                            {inquiry.email}
                                        </a>
                                        <a href={`tel:${inquiry.phone}`} className="flex items-center gap-1 hover:text-primary-600">
                                            <FiPhone className="w-4 h-4" />
                                            {inquiry.phone}
                                        </a>
                                    </div>

                                    {/* Property Info */}
                                    {inquiry.properties && (
                                        <div className="flex items-center gap-2 text-sm text-gray-500">
                                            <FiMapPin className="w-4 h-4" />
                                            <span>
                                                {inquiry.properties.category} in {inquiry.properties.area}, {inquiry.properties.state_district}
                                            </span>
                                        </div>
                                    )}

                                    {/* Message */}
                                    <div className="bg-gray-50 rounded-lg p-4 mt-3">
                                        <p className="text-gray-700 text-sm whitespace-pre-wrap">{inquiry.message}</p>
                                    </div>

                                    <div className="flex items-center gap-1 text-xs text-gray-400">
                                        <FiClock className="w-3 h-3" />
                                        {new Date(inquiry.created_at).toLocaleString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col gap-2 min-w-[140px]">
                                    <select
                                        value={inquiry.status || 'pending'}
                                        onChange={(e) => handleStatusChange(inquiry.id, e.target.value)}
                                        disabled={updating === inquiry.id}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50"
                                    >
                                        <option value="pending">Pending</option>
                                        <option value="contacted">Contacted</option>
                                        <option value="resolved">Resolved</option>
                                        <option value="closed">Closed</option>
                                    </select>
                                    <button
                                        onClick={() => setDeleteConfirm(inquiry.id)}
                                        className="w-full px-3 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 transition flex items-center justify-center gap-2"
                                    >
                                        <FiTrash2 className="w-4 h-4" />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
                        <div className="flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mx-auto mb-4">
                            <FiTrash2 className="w-8 h-8 text-red-600" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Delete Inquiry</h3>
                        <p className="text-gray-600 text-center mb-6">
                            Are you sure you want to delete this inquiry? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteConfirm(null)}
                                className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => handleDelete(deleteConfirm)}
                                className="flex-1 px-4 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InquiryManagement;
