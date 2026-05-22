import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiSearch, FiFilter, FiTrash2, FiLock, FiUnlock, FiUsers, FiAlertTriangle, FiBriefcase, FiSlash } from 'react-icons/fi';
import { MdOutlineBlock } from 'react-icons/md';
import { getAllUsers, updateUserStatus, updateUserRole, updateUserEmployeeStatus, deleteUser, blacklistUser, unblacklistUser, checkUserBlacklist, getBlacklistReasons } from '../../services/adminService';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState(null);
  const [blacklistModal, setBlacklistModal] = useState(null);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [blacklistNotes, setBlacklistNotes] = useState('');
  const [userBlacklistInfo, setUserBlacklistInfo] = useState({});
  const isMountedRef = useRef(true);
  const successTimerRef = useRef(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const showSuccessMessage = useCallback((message) => {
    setSuccessMessage(message);
    if (successTimerRef.current) {
      clearTimeout(successTimerRef.current);
    }
    successTimerRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setSuccessMessage('');
      }
    }, 3000);
  }, []);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const result = await getAllUsers();
    if (isMountedRef.current && result.data) {
      setUsers(result.data);
    }
    if (isMountedRef.current) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const filteredUsers = useMemo(() => {
    let filtered = users;

    if (statusFilter !== 'all') {
      filtered = filtered.filter((u) =>
        statusFilter === 'active' ? u.is_active : !u.is_active
      );
    }

    if (searchTerm) {
      const normalizedSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.name?.toLowerCase().includes(normalizedSearch) ||
          u.email?.toLowerCase().includes(normalizedSearch) ||
          u.phone?.includes(searchTerm)
      );
    }

    return filtered;
  }, [searchTerm, statusFilter, users]);

  const handleSearch = (value) => {
    setSearchTerm(value);
  };

  const handleStatusChange = async (userId, newStatus) => {
    const result = await updateUserStatus(userId, newStatus);
    if (result.data) {
      showSuccessMessage(newStatus ? 'User unblocked successfully' : 'User blocked successfully');
      void fetchUsers();
    }
  };

  const handleMakeAdmin = async (userId, makeAdmin) => {
    const result = await updateUserRole(userId, makeAdmin);
    if (result.data) {
      showSuccessMessage(makeAdmin ? 'User promoted to admin' : 'Admin privileges removed');
      void fetchUsers();
    }
  };

  const handleEmployeeStatusChange = async (userId, isEmployee) => {
    const result = await updateUserEmployeeStatus(userId, isEmployee);
    if (result.data) {
      showSuccessMessage(isEmployee ? 'User marked as employee' : 'Employee tag removed');
      void fetchUsers();
    }
  };

  const handleDeleteUser = async (userId) => {
    const result = await deleteUser(userId);
    if (result.error === null) {
      showSuccessMessage('User deleted successfully');
      void fetchUsers();
      setDeleteConfirmation(null);
    }
  };

  const handleBlacklistUser = async () => {
    if (!blacklistReason || !blacklistModal) return;

    const result = await blacklistUser(
      blacklistModal.id,
      blacklistReason,
      selectedUser?.id || blacklistModal.id, // admin ID
      blacklistNotes
    );

    if (result.error === null) {
      showSuccessMessage('User blacklisted successfully');
      void fetchUsers();
      setBlacklistModal(null);
      setBlacklistReason('');
      setBlacklistNotes('');
    }
  };

  const handleUnblacklistUser = async (userId) => {
    const result = await unblacklistUser(userId);
    if (result.error === null) {
      showSuccessMessage('User removed from blacklist');
      void fetchUsers();
    }
  };

  const checkBlacklist = async (userId) => {
    const result = await checkUserBlacklist(userId);
    if (result.blacklisted) {
      setUserBlacklistInfo(prev => ({
        ...prev,
        [userId]: result.data
      }));
    }
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getRoleLabel = (user) => {
    if (user.is_admin) {
      return 'Admin';
    }

    if (user.is_employee) {
      return 'Employee';
    }

    return 'User';
  };

  const getRoleClasses = (user) => {
    if (user.is_admin) {
      return 'bg-purple-100 text-purple-800';
    }

    if (user.is_employee) {
      return 'bg-sky-100 text-sky-800';
    }

    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{successMessage}</span>
          <button
            onClick={() => setSuccessMessage('')}
            className="text-green-600 hover:text-green-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* User Stats Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Total Users */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl shadow-lg p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-900 text-sm font-medium uppercase tracking-wide">Total Users</p>
              <p className="text-3xl font-bold mt-1">{users.length}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <FiUsers className="text-white text-2xl" />
            </div>
          </div>
        </div>

        {/* Active Users */}
        <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl shadow-lg p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-100 text-sm font-medium uppercase tracking-wide">Active Users</p>
              <p className="text-3xl font-bold mt-1">{users.filter(u => u.is_active).length}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <FiUnlock className="text-white text-2xl" />
            </div>
          </div>
        </div>

        {/* Blocked Users */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 rounded-xl shadow-lg p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-100 text-sm font-medium uppercase tracking-wide">Blocked Users</p>
              <p className="text-3xl font-bold mt-1">{users.filter(u => !u.is_active).length}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <FiLock className="text-white text-2xl" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-sky-500 to-sky-600 rounded-xl shadow-lg p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sky-100 text-sm font-medium uppercase tracking-wide">Employees</p>
              <p className="text-3xl font-bold mt-1">{users.filter(u => u.is_employee === true).length}</p>
            </div>
            <div className="bg-white/20 p-3 rounded-xl">
              <FiBriefcase className="text-white text-2xl" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-sky-50 border border-sky-200 text-sky-900 px-4 py-3 rounded-lg text-sm">
        Employee is an internal tag only. It does not allow admin login.
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <FiSearch className="absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <FiFilter className="text-gray-400" />
            <select
              value={statusFilter}
            onChange={(e) => {
                setStatusFilter(e.target.value);
              }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
            >
              <option value="all">All Users</option>
              <option value="active">Active</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchUsers}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-12 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 text-lg">No users found</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Blacklist
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-primary-600 font-bold">
                            {user.name?.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span>{user.name || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">{user.phone || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          user.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Blocked'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${getRoleClasses(user)}`}
                      >
                        {getRoleLabel(user)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <button
                        onClick={() => {
                          setBlacklistModal(user);
                          checkBlacklist(user.id);
                        }}
                        className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit ${
                          userBlacklistInfo[user.id]
                            ? 'bg-black text-white'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                        }`}
                      >
                        <MdOutlineBlock size={12} />
                        {userBlacklistInfo[user.id] ? 'Blacklisted' : 'Not Blacklisted'}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {formatDate(user.created_at)}
                    </td>
                    <td className="px-6 py-4 text-sm space-y-2">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="block text-primary-600 hover:text-primary-800 font-medium mb-2"
                      >
                        View Details
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleStatusChange(user.id, !user.is_active)}
                          title={user.is_active ? 'Block user' : 'Unblock user'}
                          className={`p-2 rounded-lg transition ${
                            user.is_active
                              ? 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                              : 'bg-green-100 text-green-600 hover:bg-green-200'
                          }`}
                        >
                          {user.is_active ? (
                            <FiLock size={16} />
                          ) : (
                            <FiUnlock size={16} />
                          )}
                        </button>
                        {!user.is_admin && (
                          <button
                            onClick={() => handleMakeAdmin(user.id, true)}
                            title="Make admin"
                            className="p-2 bg-purple-100 text-purple-600 rounded-lg hover:bg-purple-200 transition"
                          >
                            Admin
                          </button>
                        )}
                        {!user.is_admin && (
                          <button
                            onClick={() => handleEmployeeStatusChange(user.id, !user.is_employee)}
                            title={user.is_employee ? 'Remove employee tag' : 'Mark as employee'}
                            className={`p-2 rounded-lg transition ${
                              user.is_employee
                                ? 'bg-sky-100 text-sky-700 hover:bg-sky-200'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {user.is_employee ? <FiSlash size={16} /> : <FiBriefcase size={16} />}
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteConfirmation(user.id)}
                          title="Delete user"
                          className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* User Details Modal */}
      {selectedUser && (
        <UserDetailModal
          user={selectedUser}
          onClose={() => setSelectedUser(null)}
          onStatusChange={(status) => {
            handleStatusChange(selectedUser.id, status);
            setSelectedUser(null);
          }}
          onMakeAdmin={(isAdmin) => {
            handleMakeAdmin(selectedUser.id, isAdmin);
            setSelectedUser(null);
          }}
          onEmployeeStatusChange={(isEmployee) => {
            handleEmployeeStatusChange(selectedUser.id, isEmployee);
            setSelectedUser(null);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Delete User</h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to permanently delete this user? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmation(null)}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteUser(deleteConfirmation)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Blacklist Modal */}
      {blacklistModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center">
                <MdOutlineBlock className="text-white text-xl" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">
                {userBlacklistInfo[blacklistModal.id] ? 'Blacklist Info' : 'Blacklist User'}
              </h2>
            </div>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="font-semibold text-gray-900">{blacklistModal.name}</p>
              <p className="text-sm text-gray-600">{blacklistModal.email}</p>
              <p className="text-sm text-gray-600">{blacklistModal.phone || 'No phone'}</p>
            </div>

            {userBlacklistInfo[blacklistModal.id] ? (
              <>
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">
                    <strong>Reason:</strong> {userBlacklistInfo[blacklistModal.id].reason}
                  </p>
                  {userBlacklistInfo[blacklistModal.id].notes && (
                    <p className="text-sm text-red-800 mt-2">
                      <strong>Notes:</strong> {userBlacklistInfo[blacklistModal.id].notes}
                    </p>
                  )}
                  <p className="text-xs text-red-600 mt-2">
                    Blacklisted on {new Date(userBlacklistInfo[blacklistModal.id].blacklisted_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      handleUnblacklistUser(blacklistModal.id);
                      setBlacklistModal(null);
                    }}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                  >
                    Remove from Blacklist
                  </button>
                  <button
                    onClick={() => setBlacklistModal(null)}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition font-medium"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reason for Blacklist *
                  </label>
                  <select
                    value={blacklistReason}
                    onChange={(e) => setBlacklistReason(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  >
                    <option value="">Select a reason...</option>
                    {getBlacklistReasons().map(reason => (
                      <option key={reason.value} value={reason.value}>{reason.label}</option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={blacklistNotes}
                    onChange={(e) => setBlacklistNotes(e.target.value)}
                    rows="3"
                    placeholder="Add any additional context..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                  />
                </div>

                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
                  <FiAlertTriangle className="text-yellow-600 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-800">
                    Blacklisting will block this user from purchasing credits and prevent account access.
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setBlacklistModal(null);
                      setBlacklistReason('');
                      setBlacklistNotes('');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleBlacklistUser}
                    disabled={!blacklistReason}
                    className="flex-1 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Blacklist User
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// User Detail Modal
const UserDetailModal = ({ user, onClose, onStatusChange, onMakeAdmin, onEmployeeStatusChange }) => {
  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">User Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          {/* Profile Section */}
          <div className="flex items-center gap-4 pb-6 border-b">
            <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-600">
                {user.name?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">{user.name}</h3>
              <p className="text-gray-600">{user.email}</p>
            </div>
          </div>

          {/* User Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">Email</label>
              <p className="text-gray-900 break-all">{user.email}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Phone</label>
              <p className="text-gray-900">{user.phone || 'Not provided'}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Status</label>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                  user.is_active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {user.is_active ? 'Active' : 'Blocked'}
              </span>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Role</label>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                  user.is_admin
                    ? 'bg-purple-100 text-purple-800'
                    : user.is_employee
                    ? 'bg-sky-100 text-sky-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {user.is_admin ? 'Admin' : user.is_employee ? 'Employee' : 'User'}
              </span>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Joined</label>
              <p className="text-gray-900">{formatDate(user.created_at)}</p>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">Last Updated</label>
              <p className="text-gray-900">{formatDate(user.updated_at)}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-3">
            <button
              onClick={() => onStatusChange(!user.is_active)}
              className={`w-full px-4 py-2 rounded-lg font-medium transition ${
                user.is_active
                  ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                  : 'bg-green-100 text-green-700 hover:bg-green-200'
              }`}
            >
              {user.is_active ? 'Block User' : 'Unblock User'}
            </button>
            {!user.is_admin && (
              <button
                onClick={() => onMakeAdmin(true)}
                className="w-full px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200 transition"
              >
                Promote to Admin
              </button>
            )}
            {!user.is_admin && (
              <button
                onClick={() => onEmployeeStatusChange(!user.is_employee)}
                className="w-full px-4 py-2 bg-sky-100 text-sky-700 rounded-lg font-medium hover:bg-sky-200 transition"
              >
                {user.is_employee ? 'Remove Employee Tag' : 'Mark as Employee'}
              </button>
            )}
          </div>

          {/* Close Button */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
