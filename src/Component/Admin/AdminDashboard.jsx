'use client';

import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { FiUsers, FiDollarSign, FiTrendingUp, FiAlertCircle, FiMenu, FiX, FiHome, FiSearch } from 'react-icons/fi';
import { MdDashboard, MdPayment, MdPeople, MdImage, MdHelp, MdFeedback } from 'react-icons/md';
import {
  getDashboardStats,
  getTransactionStats,
  getDailyListingReport,
  getDailyEmployeeWiseListingReport,
} from '../../services/adminService';
import PaymentMonitoring from './PaymentMonitoring';
import UserManagement from './UserManagement';
import CoverPhotoManagement from './CoverPhotoManagement';
import InquiryManagement from './InquiryManagement';
import FeedbackManagement from './FeedbackManagement';
import PropertyManagement from './PropertyManagement';
import SearchHistoryManagement from './SearchHistoryManagement';
import ReferralManagement from './ReferralManagement';

const LOGO_SRC = '/logo.png';
const EMPTY_EMPLOYEE_LISTING_REPORT = {
  days: 7,
  employees: [],
  dailyRows: [],
  todayCountsByEmployeeId: {},
  todayTotal: 0,
  totalsByEmployeeId: {},
  grandTotal: 0
};

const AdminDashboard = () => {
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [transactionStats, setTransactionStats] = useState(null);
  const [listingReport, setListingReport] = useState({
    days: 7,
    dailyCounts: [],
    totalNewListings: 0,
    todaysNewListings: 0
  });
  const [employeeListingReport, setEmployeeListingReport] = useState(EMPTY_EMPLOYEE_LISTING_REPORT);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const canUsePortal = mounted;

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'auto';
    }
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, [mobileMenuOpen]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [statsRes, transRes, reportRes, employeeReportRes] = await Promise.all([
        getDashboardStats(),
        getTransactionStats(),
        getDailyListingReport(7),
        getDailyEmployeeWiseListingReport(7)
      ]);

      console.log('Dashboard API Response - statsRes:', statsRes);
      console.log('Dashboard API Response - transRes:', transRes);

      if (statsRes?.data) {
        console.log('Setting stats:', statsRes.data);
        setStats(statsRes.data);
      } else {
        console.warn('No stats data received, using empty object');
        setStats({
          totalUsers: 0,
          activeUsers: 0,
          totalProperties: 0,
          pendingProperties: 0,
          totalOrders: 0,
          totalFeedback: 0
        });
      }
      if (transRes?.data) {
        setTransactionStats(transRes.data);
      }
      if (reportRes?.data) {
        setListingReport(reportRes.data);
      }
      if (employeeReportRes?.data) {
        setEmployeeListingReport(employeeReportRes.data);
      } else {
        setEmployeeListingReport(EMPTY_EMPLOYEE_LISTING_REPORT);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setStats({
        totalUsers: 0,
        activeUsers: 0,
        totalProperties: 0,
        pendingProperties: 0,
        totalOrders: 0,
        totalFeedback: 0
      });
      setListingReport({
        days: 7,
        dailyCounts: [],
        totalNewListings: 0,
        todaysNewListings: 0
      });
      setEmployeeListingReport(EMPTY_EMPLOYEE_LISTING_REPORT);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const menuItems = [
    { id: 'overview', label: 'Overview', icon: MdDashboard },
    { id: 'properties', label: 'Property Management', icon: FiHome },
    { id: 'users', label: 'User Management', icon: MdPeople },
    { id: 'payments', label: 'Payment Transactions', icon: MdPayment },
    { id: 'referrals', label: 'Referral Management', icon: FiDollarSign },
    { id: 'search-history', label: 'Search History', icon: FiSearch },
    { id: 'cover-photos', label: 'Cover Photos', icon: MdImage },
    { id: 'inquiries', label: 'Inquiries', icon: MdHelp },
    { id: 'feedback', label: 'Feedback', icon: MdFeedback },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img src={LOGO_SRC} alt="Logo" className="w-12 h-12 object-contain" />
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Admin Dashboard</h1>
                <p className="text-gray-600 mt-1 md:mt-2 text-sm md:text-base">Manage users, payments, cover photos, and platform operations</p>
              </div>
            </div>
            {/* Total Admin Users Badge */}
            <div className="hidden md:flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 px-5 py-3 rounded-xl border border-blue-200">
              <div className="bg-blue-600 p-2 rounded-lg">
                <FiUsers className="text-white text-xl" />
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium uppercase tracking-wide">Total Admin Users</p>
                <p className="text-2xl font-bold text-gray-900 leading-tight">{stats?.totalUsers || 0}</p>
              </div>
            </div>
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-primary-600 transition-all duration-300"
            >
              <FiMenu className="text-2xl" />
            </button>
          </div>
          {/* Mobile Total Admin Users Badge */}
          <div className="md:hidden mt-4 flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 rounded-xl border border-blue-200">
            <div className="bg-blue-600 p-2 rounded-lg">
              <FiUsers className="text-white text-lg" />
            </div>
            <div>
              <p className="text-xs text-gray-600 font-medium uppercase tracking-wide">Total Admin Users</p>
              <p className="text-xl font-bold text-gray-900 leading-tight">{stats?.totalUsers || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Navigation Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="hidden md:flex space-x-2 border-b border-gray-200 overflow-x-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`px-4 py-2 font-medium text-sm border-b-2 transition-all duration-500 whitespace-nowrap flex items-center gap-2 ${
                activeTab === item.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <item.icon className="text-lg" />
              {item.label}
            </button>
          ))}
        </div>

        {/* Mobile Current Tab Indicator */}
        <div className="md:hidden flex items-center justify-between py-3 border-b border-gray-200">
          <div className="flex items-center gap-2 text-primary-600 font-medium">
            {(() => {
              const currentItem = menuItems.find(item => item.id === activeTab);
              return currentItem ? (
                <>
                  <currentItem.icon className="text-xl" />
                  <span>{currentItem.label}</span>
                </>
              ) : null;
            })()}
          </div>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="text-sm text-gray-500 hover:text-primary-600 transition-colors duration-300"
          >
            Change
          </button>
        </div>
      </div>

      {/* Mobile Menu - Rendered via Portal */}
      {canUsePortal && ReactDOM.createPortal(
        <>
          {/* Mobile Menu Overlay */}
          <div
            className={`md:hidden fixed inset-0 backdrop-blur-sm transition-all duration-500 ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            style={{ zIndex: 9998 }}
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Mobile Sidebar */}
          <div
            className={`md:hidden fixed top-0 right-0 h-full w-[300px] bg-white shadow-2xl transition-all duration-500 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'}`}
            style={{ zIndex: 9999 }}
          >
            <div className="p-6 h-full overflow-y-auto">
              {/* Close Button */}
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-lg font-semibold text-gray-900">Menu</h2>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors duration-300"
                >
                  <FiX className="text-2xl text-gray-600" />
                </button>
              </div>

              {/* Menu Items */}
              <div className="flex flex-col gap-2">
                {menuItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleTabChange(item.id)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all duration-500 ${
                      activeTab === item.id
                        ? 'bg-primary-50 text-primary-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-primary-600'
                    }`}
                  >
                    <item.icon className="text-xl" />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <OverviewTab
            stats={stats}
            transactionStats={transactionStats}
            listingReport={listingReport}
            employeeListingReport={employeeListingReport}
          />
        )}
        {activeTab === 'properties' && <PropertyManagement />}
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'payments' && <PaymentMonitoring />}
        {activeTab === 'referrals' && <ReferralManagement />}
        {activeTab === 'search-history' && <SearchHistoryManagement />}
        {activeTab === 'cover-photos' && <CoverPhotoManagement />}
        {activeTab === 'inquiries' && <InquiryManagement />}
        {activeTab === 'feedback' && <FeedbackManagement />}
      </div>
    </div>
  );
};

// Overview Tab Component
const OverviewTab = ({ stats, transactionStats, listingReport, employeeListingReport }) => {
  const employeeColumns = employeeListingReport?.employees || [];
  const employeeDailyRows = employeeListingReport?.dailyRows || [];
  const hasEmployeeListings = employeeColumns.length > 0;

  return (
    <div className="space-y-8">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Admin Users */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Admin Users</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.totalUsers || 0}</p>
              <p className="text-green-600 text-sm mt-2">Active: {stats?.activeUsers || 0}</p>
            </div>
            <div className="bg-blue-100 p-4 rounded-full">
              <FiUsers className="text-blue-600 text-2xl" />
            </div>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Revenue</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                ${transactionStats?.totalRevenue?.toFixed(2) || '0.00'}
              </p>
              <p className="text-green-600 text-sm mt-2">
                {transactionStats?.successfulTransactions || 0} Successful
              </p>
            </div>
            <div className="bg-green-100 p-4 rounded-full">
              <FiDollarSign className="text-green-600 text-2xl" />
            </div>
          </div>
        </div>

        {/* Total Transactions */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Transactions</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {transactionStats?.totalTransactions || 0}
              </p>
              <p className="text-yellow-600 text-sm mt-2">
                {transactionStats?.pendingTransactions || 0} Pending
              </p>
            </div>
            <div className="bg-yellow-100 p-4 rounded-full">
              <FiTrendingUp className="text-yellow-600 text-2xl" />
            </div>
          </div>
        </div>

        {/* Failed Transactions */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Failed Transactions</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {transactionStats?.failedTransactions || 0}
              </p>
              <p className="text-red-600 text-sm mt-2">Requires attention</p>
            </div>
            <div className="bg-red-100 p-4 rounded-full">
              <FiAlertCircle className="text-red-600 text-2xl" />
            </div>
          </div>
        </div>

        {/* Total Properties */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Properties</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.totalProperties || 0}</p>
              <p className="text-purple-600 text-sm mt-2">
                {stats?.pendingProperties || 0} Pending Review
              </p>
            </div>
            <div className="bg-purple-100 p-4 rounded-full">
              <FiTrendingUp className="text-purple-600 text-2xl" />
            </div>
          </div>
        </div>

        {/* Total Orders */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Total Orders</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.totalOrders || 0}</p>
            </div>
            <div className="bg-primary-100 p-4 rounded-full">
              <FiDollarSign className="text-primary-600 text-2xl" />
            </div>
          </div>
        </div>

        {/* Feedback */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">User Feedback</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.totalFeedback || 0}</p>
            </div>
            <div className="bg-pink-100 p-4 rounded-full">
              <FiAlertCircle className="text-pink-600 text-2xl" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Today's Listings</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{listingReport?.todaysNewListings || 0}</p>
              <p className="text-cyan-600 text-sm mt-2">New properties created today</p>
            </div>
            <div className="bg-cyan-100 p-4 rounded-full">
              <MdDashboard className="text-cyan-600 text-2xl" />
            </div>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Transaction Summary */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Transaction Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Successful</span>
              <span className="font-semibold text-green-600">
                {transactionStats?.successfulTransactions || 0}
              </span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Pending</span>
              <span className="font-semibold text-yellow-600">
                {transactionStats?.pendingTransactions || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Failed</span>
              <span className="font-semibold text-red-600">
                {transactionStats?.failedTransactions || 0}
              </span>
            </div>
          </div>
        </div>

        {/* Platform Overview */}
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Platform Overview</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Active Users</span>
              <span className="font-semibold text-primary-600">{stats?.activeUsers || 0}</span>
            </div>
            <div className="flex justify-between items-center pb-3 border-b">
              <span className="text-gray-600">Properties Pending Review</span>
              <span className="font-semibold text-orange-600">
                {stats?.pendingProperties || 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Total Properties</span>
              <span className="font-semibold text-purple-600">{stats?.totalProperties || 0}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Daily Listing Report</h3>
            <p className="text-sm text-gray-500">New listings created in the last 7 days</p>
          </div>
          <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700">
            Total: <span className="font-semibold text-gray-900">{listingReport?.totalNewListings || 0}</span>
          </div>
        </div>
        <div className="space-y-3">
          {(listingReport?.dailyCounts || []).map((day) => {
            const maxCount = Math.max(...(listingReport?.dailyCounts || []).map((item) => item.count), 1);
            const width = `${Math.max((day.count / maxCount) * 100, day.count > 0 ? 12 : 0)}%`;

            return (
              <div key={day.date} className="grid grid-cols-[80px_1fr_40px] items-center gap-3">
                <span className="text-sm font-medium text-gray-600">{day.label}</span>
                <div className="h-3 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary-500 to-cyan-500"
                    style={{ width }}
                  />
                </div>
                <span className="text-right text-sm font-semibold text-gray-900">{day.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col gap-3 border-b border-gray-100 pb-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Daily Employee-Wise Listing</h3>
            <p className="text-sm text-gray-500">
              Users with at least 1 property are shown here. Today's counts appear first, followed by the last {employeeListingReport?.days || 7} days.
            </p>
          </div>
          <div className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700">
            Total: <span className="font-semibold text-gray-900">{employeeListingReport?.grandTotal || 0}</span>
          </div>
        </div>

        {!hasEmployeeListings ? (
          <div className="py-10 text-center">
            <p className="text-base font-semibold text-gray-800">No employee-wise listings found</p>
            <p className="mt-2 text-sm text-gray-500">
              No users have created any property listings yet.
            </p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            <div className="rounded-xl border border-cyan-100 bg-cyan-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h4 className="text-base font-semibold text-gray-900">Today Employee-Wise Listing</h4>
                  <p className="text-sm text-gray-600">How many listings each employee created today.</p>
                </div>
                <div className="rounded-lg bg-white px-3 py-2 text-sm text-gray-700 shadow-sm">
                  Today Total: <span className="font-semibold text-gray-900">{employeeListingReport?.todayTotal || 0}</span>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {employeeColumns.map((employee) => (
                  <div key={`today-${employee.id}`} className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-cyan-100">
                    <p className="text-sm font-medium text-gray-600">{employee.name}</p>
                    <p className="mt-2 text-2xl font-bold text-gray-900">
                      {employeeListingReport?.todayCountsByEmployeeId?.[employee.id] || 0}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Listings created today</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-white px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Day
                    </th>
                    {employeeColumns.map((employee) => (
                      <th
                        key={employee.id}
                        className="whitespace-nowrap px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500"
                      >
                        {employee.name}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {employeeDailyRows.map((day) => (
                    <tr key={day.date}>
                      <td className="sticky left-0 border-t border-gray-100 bg-white px-4 py-3 text-sm font-medium text-gray-700">
                        {day.label}
                      </td>
                      {employeeColumns.map((employee) => (
                        <td
                          key={`${day.date}-${employee.id}`}
                          className="border-t border-gray-100 px-4 py-3 text-right text-sm text-gray-700"
                        >
                          {day.countsByEmployeeId?.[employee.id] || 0}
                        </td>
                      ))}
                      <td className="border-t border-gray-100 px-4 py-3 text-right text-sm font-semibold text-gray-900">
                        {day.total || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td className="sticky left-0 border-t-2 border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900">
                      Total
                    </td>
                    {employeeColumns.map((employee) => (
                      <td
                        key={`total-${employee.id}`}
                        className="border-t-2 border-gray-200 bg-gray-50 px-4 py-3 text-right text-sm font-semibold text-gray-900"
                      >
                        {employeeListingReport?.totalsByEmployeeId?.[employee.id] || 0}
                      </td>
                    ))}
                    <td className="border-t-2 border-gray-200 bg-gray-50 px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      {employeeListingReport?.grandTotal || 0}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
