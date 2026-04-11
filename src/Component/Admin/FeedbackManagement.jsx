import React, { useState, useEffect } from 'react';
import { FiUser, FiClock, FiTrash2, FiCheck, FiX, FiMessageCircle, FiUsers, FiSearch } from 'react-icons/fi';
import { getAllFeedback, updateFeedbackStatus, deleteFeedback } from '../../services/feedbackService';
import { getDashboardStats } from '../../services/adminService';

const FeedbackManagement = () => {
    const [feedbackList, setFeedbackList] = useState([]);
    const [filteredFeedback, setFilteredFeedback] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [updating, setUpdating] = useState(null);
    const [totalUsers, setTotalUsers] = useState(0);

    useEffect(() => {
        fetchFeedback();
        fetchUserStats();
    }, []);

    const fetchUserStats = async () => {
        const result = await getDashboardStats();
        if (result.data) {
            setTotalUsers(result.data.totalUsers || 0);
        }
    };

    const fetchFeedback = async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await getAllFeedback();
            if (error) throw error;
            setFeedbackList(data || []);
            filterFeedback(data || [], searchTerm, filter);
        } catch (err) {
            console.error('Error fetching feedback:', err);
            setError('Failed to load feedback');
        } finally {
            setLoading(false);
        }
    };

    const filterFeedback = (fbList, search, status) => {
        let filtered = fbList;

        if (status !== 'all') {
            filtered = filtered.filter((f) => f.status === status);
        }

        if (search) {
            filtered = filtered.filter(
                (f) =>
                    f.name?.toLowerCase().includes(search.toLowerCase()) ||
                    f.email?.toLowerCase().includes(search.toLowerCase()) ||
                    f.feedback?.toLowerCase().includes(search.toLowerCase())
            );
        }

        setFilteredFeedback(filtered);
    };

    const handleSearch = (value) => {
        setSearchTerm(value);
        filterFeedback(feedbackList, value, filter);
    };

    const handleApprove = async (feedbackId) => {
        setUpdating(feedbackId);
        try {
            const { error } = await updateFeedbackStatus(feedbackId, 'approved');
            if (error) throw error;
            const updated = feedbackList.map(fb =>
                fb.id === feedbackId ? { ...fb, status: 'approved' } : fb
            );
            setFeedbackList(updated);
            filterFeedback(updated, searchTerm, filter);
        } catch (err) {
            console.error('Error approving feedback:', err);
            alert('Failed to approve feedback');
        } finally {
            setUpdating(null);
        }
    };

    const handleReject = async (feedbackId) => {
        setUpdating(feedbackId);
        try {
            const { error } = await updateFeedbackStatus(feedbackId, 'rejected');
            if (error) throw error;
            const updated = feedbackList.map(fb =>
                fb.id === feedbackId ? { ...fb, status: 'rejected' } : fb
            );
            setFeedbackList(updated);
            filterFeedback(updated, searchTerm, filter);
        } catch (err) {
            console.error('Error rejecting feedback:', err);
            alert('Failed to reject feedback');
        } finally {
            setUpdating(null);
        }
    };

    const handleDelete = async (feedbackId) => {
        try {
            const { error } = await deleteFeedback(feedbackId);
            if (error) throw error;
            const updated = feedbackList.filter(fb => fb.id !== feedbackId);
            setFeedbackList(updated);
            filterFeedback(updated, searchTerm, filter);
            setDeleteConfirm(null);
        } catch (err) {
            console.error('Error deleting feedback:', err);
            alert('Failed to delete feedback');
        }
    };

    const getStatusBadge = (status) => {
        const styles = {
            pending: 'bg-yellow-100 text-yellow-800',
            approved: 'bg-green-100 text-green-800',
            rejected: 'bg-red-100 text-red-800'
        };
        return (
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status] || styles.pending}`}>
                {status?.charAt(0).toUpperCase() + status?.slice(1) || 'Pending'}
            </span>
        );
    };

    const stats = {
        total: feedbackList.length,
        pending: feedbackList.filter(fb => fb.status === 'pending').length,
        approved: feedbackList.filter(fb => fb.status === 'approved').length,
        rejected: feedbackList.filter(fb => fb.status === 'rejected').length
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
                    onClick={fetchFeedback}
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
                    <p className="text-gray-600 text-sm">Total Feedback</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="bg-yellow-50 rounded-lg shadow p-4">
                    <p className="text-yellow-700 text-sm">Pending</p>
                    <p className="text-2xl font-bold text-yellow-800">{stats.pending}</p>
                </div>
                <div className="bg-green-50 rounded-lg shadow p-4">
                    <p className="text-green-700 text-sm">Approved</p>
                    <p className="text-2xl font-bold text-green-800">{stats.approved}</p>
                </div>
                <div className="bg-red-50 rounded-lg shadow p-4">
                    <p className="text-red-700 text-sm">Rejected</p>
                    <p className="text-2xl font-bold text-red-800">{stats.rejected}</p>
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
                            placeholder="Search by name, email, or feedback..."
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
                                filterFeedback(feedbackList, searchTerm, e.target.value);
                            }}
                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                        >
                            <option value="all">All Status</option>
                            <option value="pending">Pending</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                        </select>
                    </div>

                    {/* Refresh Button */}
                    <button
                        onClick={fetchFeedback}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
                    >
                        Refresh
                    </button>
                </div>
            </div>

            {/* Feedback List */}
            {filteredFeedback.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                    <FiMessageCircle className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">No Feedback</h3>
                    <p className="text-gray-500">
                        {filter === 'all'
                            ? 'No feedback has been submitted yet.'
                            : `No ${filter} feedback found.`}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredFeedback.map(feedback => (
                        <div key={feedback.id} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
                            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                                {/* Feedback Info */}
                                <div className="flex-1 space-y-3">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                            <FiUser className="text-gray-500" />
                                            {feedback.name}
                                        </h3>
                                        {getStatusBadge(feedback.status)}
                                    </div>

                                    {/* Feedback Content */}
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <p className="text-gray-700 whitespace-pre-wrap">{feedback.feedback}</p>
                                    </div>

                                    <div className="flex items-center gap-1 text-xs text-gray-400">
                                        <FiClock className="w-3 h-3" />
                                        {new Date(feedback.created_at).toLocaleString('en-US', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric',
                                            hour: '2-digit',
                                            minute: '2-digit'
                                        })}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex flex-col gap-2 min-w-[160px]">
                                    {feedback.status === 'pending' && (
                                        <>
                                            <button
                                                onClick={() => handleApprove(feedback.id)}
                                                disabled={updating === feedback.id}
                                                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                                            >
                                                <FiCheck className="w-4 h-4" />
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleReject(feedback.id)}
                                                disabled={updating === feedback.id}
                                                className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 transition flex items-center justify-center gap-2 disabled:opacity-50"
                                            >
                                                <FiX className="w-4 h-4" />
                                                Reject
                                            </button>
                                        </>
                                    )}
                                    {feedback.status === 'rejected' && (
                                        <button
                                            onClick={() => handleApprove(feedback.id)}
                                            disabled={updating === feedback.id}
                                            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <FiCheck className="w-4 h-4" />
                                            Approve
                                        </button>
                                    )}
                                    {feedback.status === 'approved' && (
                                        <button
                                            onClick={() => handleReject(feedback.id)}
                                            disabled={updating === feedback.id}
                                            className="w-full px-4 py-2 bg-orange-500 text-white rounded-lg text-sm hover:bg-orange-600 transition flex items-center justify-center gap-2 disabled:opacity-50"
                                        >
                                            <FiX className="w-4 h-4" />
                                            Revoke
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setDeleteConfirm(feedback.id)}
                                        className="w-full px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm hover:bg-red-50 transition flex items-center justify-center gap-2"
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
                        <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Delete Feedback</h3>
                        <p className="text-gray-600 text-center mb-6">
                            Are you sure you want to delete this feedback? This action cannot be undone.
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

export default FeedbackManagement;
