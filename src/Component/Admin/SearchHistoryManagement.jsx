'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { FiClock, FiMapPin, FiRefreshCw, FiSearch, FiSliders, FiUser } from 'react-icons/fi';
import { getCustomerSearchHistory } from '../../services/searchHistoryService';

const formatDateTime = (value) => {
    if (!value) {
        return 'Unknown';
    }

    return new Date(value).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
};

const formatLocation = (location) => {
    if (!location) {
        return 'Any location';
    }

    if (typeof location === 'string') {
        return location;
    }

    return [location.upazilla, location.district, location.division].filter(Boolean).join(', ') || 'Any location';
};

const getCustomerLabel = (entry) => {
    if (entry?.users?.name) {
        return entry.users.name;
    }

    if (entry?.users?.email) {
        return entry.users.email;
    }

    return 'Anonymous visitor';
};

const getCustomerMeta = (entry) => {
    const details = [entry?.users?.email, entry?.users?.phone].filter(Boolean);
    return details.join(' • ') || 'No account attached';
};

const SearchHistoryManagement = () => {
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchSearchHistory();
    }, []);

    const fetchSearchHistory = async () => {
        setLoading(true);
        setError(null);

        try {
            const { data, error: fetchError } = await getCustomerSearchHistory();

            if (fetchError) {
                throw fetchError;
            }

            setHistory(data || []);
        } catch (err) {
            console.error('Error loading search history:', err);
            setError(err.message || 'Failed to load customer search history');
        } finally {
            setLoading(false);
        }
    };

    const filteredHistory = useMemo(() => {
        const normalizedSearch = searchTerm.trim().toLowerCase();

        if (!normalizedSearch) {
            return history;
        }

        return history.filter((entry) => {
            const haystack = [
                entry.search_query,
                entry.selected_category,
                entry.selected_price_range,
                entry.page_path,
                formatLocation(entry.selected_location),
                entry.users?.name,
                entry.users?.email,
                entry.users?.phone,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            return haystack.includes(normalizedSearch);
        });
    }, [history, searchTerm]);

    const stats = useMemo(() => ({
        total: history.length,
        anonymous: history.filter((entry) => !entry.user_id).length,
        withQuery: history.filter((entry) => Boolean(entry.search_query)).length,
        avgResults: history.length
            ? Math.round(history.reduce((sum, entry) => sum + (entry.result_count || 0), 0) / history.length)
            : 0,
    }), [history]);

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
                    onClick={fetchSearchHistory}
                    className="mt-4 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-lg shadow p-4">
                    <p className="text-gray-600 text-sm">Total Searches</p>
                    <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
                </div>
                <div className="bg-slate-50 rounded-lg shadow p-4">
                    <p className="text-slate-600 text-sm">Anonymous</p>
                    <p className="text-2xl font-bold text-slate-900">{stats.anonymous}</p>
                </div>
                <div className="bg-blue-50 rounded-lg shadow p-4">
                    <p className="text-blue-700 text-sm">With Search Text</p>
                    <p className="text-2xl font-bold text-blue-800">{stats.withQuery}</p>
                </div>
                <div className="bg-emerald-50 rounded-lg shadow p-4">
                    <p className="text-emerald-700 text-sm">Avg Results</p>
                    <p className="text-2xl font-bold text-emerald-800">{stats.avgResults}</p>
                </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <FiSearch className="absolute left-3 top-3 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by customer, query, location, category, or price range..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                        />
                    </div>
                    <button
                        onClick={fetchSearchHistory}
                        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium inline-flex items-center justify-center gap-2"
                    >
                        <FiRefreshCw />
                        Refresh
                    </button>
                </div>
            </div>

            {filteredHistory.length === 0 ? (
                <div className="bg-white rounded-lg shadow p-12 text-center">
                    <FiSearch className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">No Search History</h3>
                    <p className="text-gray-500">
                        {history.length === 0
                            ? 'No customer searches have been logged yet.'
                            : 'No search history matches the current filter.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredHistory.map((entry) => (
                        <div key={entry.id} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition">
                            <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
                                <div className="flex-1 space-y-4">
                                    <div className="flex items-center gap-3 flex-wrap">
                                        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                            <FiSearch className="text-gray-500" />
                                            {entry.search_query || 'Filter-only search'}
                                        </h3>
                                        <span className="px-3 py-1 text-xs font-semibold rounded-full bg-primary-50 text-primary-700">
                                            {entry.result_count || 0} results
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 text-sm">
                                        <div className="flex items-start gap-2 text-gray-600">
                                            <FiUser className="mt-0.5 text-gray-400" />
                                            <div>
                                                <p className="font-medium text-gray-900">{getCustomerLabel(entry)}</p>
                                                <p>{getCustomerMeta(entry)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2 text-gray-600">
                                            <FiMapPin className="mt-0.5 text-gray-400" />
                                            <div>
                                                <p className="font-medium text-gray-900">Location</p>
                                                <p>{formatLocation(entry.selected_location)}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2 text-gray-600">
                                            <FiSliders className="mt-0.5 text-gray-400" />
                                            <div>
                                                <p className="font-medium text-gray-900">Filters</p>
                                                <p>
                                                    {[entry.selected_category, entry.selected_price_range]
                                                        .filter(Boolean)
                                                        .join(' • ') || 'Default filters'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-2 text-gray-600">
                                            <FiClock className="mt-0.5 text-gray-400" />
                                            <div>
                                                <p className="font-medium text-gray-900">Logged</p>
                                                <p>{formatDateTime(entry.created_at)}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="min-w-[180px] rounded-xl bg-gray-50 border border-gray-200 px-4 py-3 text-sm text-gray-600">
                                    <p className="font-medium text-gray-900">Page</p>
                                    <p className="break-all mt-1">{entry.page_path || '/'}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SearchHistoryManagement;
