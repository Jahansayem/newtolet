import React, { useState, useEffect, useRef } from 'react';
import { FiUpload, FiTrash2, FiEye, FiEyeOff, FiArrowUp, FiArrowDown, FiLink, FiImage, FiUsers } from 'react-icons/fi';
import {
  COVER_BANNER_GUIDANCE,
  getCoverPhotos,
  addCoverPhoto,
  deleteCoverPhoto,
  toggleCoverPhotoStatus,
  updateCoverPhotoOrder,
  uploadCoverImageToSupabase,
  validateCoverImage
} from '../../services/coverPhotoService';
import { getDashboardStats } from '../../services/adminService';

const CoverPhotoManagement = () => {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [uploadMode, setUploadMode] = useState('file'); // 'file' or 'url'
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [uploadInfoMessage, setUploadInfoMessage] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    fetchPhotos();
    fetchUserStats();
  }, []);

  const fetchUserStats = async () => {
    const result = await getDashboardStats();
    if (result.data) {
      setTotalUsers(result.data.totalUsers || 0);
    }
  };

  const fetchPhotos = async () => {
    setLoading(true);
    const result = await getCoverPhotos();
    if (result.data) {
      setPhotos(result.data);
    }
    setLoading(false);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setErrorMessage('Please select an image file');
        setTimeout(() => setErrorMessage(''), 3000);
        return;
      }

      const validation = await validateCoverImage(file);
      if (!validation.valid) {
        setErrorMessage(validation.error);
        setUploadInfoMessage('');
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
        setTimeout(() => setErrorMessage(''), 5000);
        return;
      }

      setSelectedFile(file);
      setUploadInfoMessage(
        validation.isBelowRecommended
          ? `Accepted at ${validation.width}x${validation.height}px, but sharper banners usually start around ${COVER_BANNER_GUIDANCE.recommendedWidth}x${COVER_BANNER_GUIDANCE.recommendedHeight}px.`
          : `Image size looks good: ${validation.width}x${validation.height}px.`
      );
      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setFilePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddPhoto = async () => {
    // Validate based on upload mode
    if (uploadMode === 'url') {
      if (!newPhotoUrl.trim()) {
        setErrorMessage('Please enter an image URL');
        setTimeout(() => setErrorMessage(''), 3000);
        return;
      }
    } else {
      if (!selectedFile) {
        setErrorMessage('Please select an image file');
        setTimeout(() => setErrorMessage(''), 3000);
        return;
      }
    }

    setUploading(true);
    let imageUrl = newPhotoUrl;
    let uploadResult = null;

    // If file upload mode, upload to Supabase first
    if (uploadMode === 'file' && selectedFile) {
      uploadResult = await uploadCoverImageToSupabase(selectedFile);
      if (uploadResult.error) {
        setErrorMessage(`Upload failed: ${uploadResult.error.message || 'Unknown error'}`);
        setTimeout(() => setErrorMessage(''), 5000);
        setUploading(false);
        return;
      }
      imageUrl = uploadResult.data.url;
    }

    const nextOrder = photos.length + 1;
    const result = await addCoverPhoto(imageUrl, nextOrder);

    if (result.data) {
      const optimizationSummary = uploadResult?.metadata
        ? ` Optimized to ${uploadResult.metadata.targetDimensions.width}x${uploadResult.metadata.targetDimensions.height}px at about ${uploadResult.metadata.compressedSizeKB} KB.`
        : '';
      setSuccessMessage(`Cover photo added successfully.${optimizationSummary}`);
      resetUploadForm();
      fetchPhotos();
      setTimeout(() => setSuccessMessage(''), 3000);
    } else {
      setErrorMessage('Failed to add cover photo');
      setTimeout(() => setErrorMessage(''), 3000);
    }
    setUploading(false);
  };

  const resetUploadForm = () => {
    setNewPhotoUrl('');
    setSelectedFile(null);
    setFilePreview(null);
    setUploadInfoMessage('');
    setShowUploadForm(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeletePhoto = async (id) => {
    const result = await deleteCoverPhoto(id);
    if (result.error === null) {
      setSuccessMessage('Cover photo deleted successfully');
      fetchPhotos();
      setTimeout(() => setSuccessMessage(''), 3000);
    } else {
      setErrorMessage('Failed to delete cover photo');
      setTimeout(() => setErrorMessage(''), 3000);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const result = await toggleCoverPhotoStatus(id, !currentStatus);
    if (result.data) {
      setSuccessMessage(!currentStatus ? 'Photo activated' : 'Photo deactivated');
      fetchPhotos();
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const handleMoveUp = async (index) => {
    if (index === 0) return;

    const newPhotos = [...photos];
    const temp = newPhotos[index];
    newPhotos[index] = newPhotos[index - 1];
    newPhotos[index - 1] = temp;

    const updates = newPhotos.map((photo, idx) => ({
      id: photo.id,
      order_index: idx + 1
    }));

    const result = await updateCoverPhotoOrder(updates);
    if (result.error === null) {
      setPhotos(newPhotos);
      setSuccessMessage('Photo order updated');
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

  const handleMoveDown = async (index) => {
    if (index === photos.length - 1) return;

    const newPhotos = [...photos];
    const temp = newPhotos[index];
    newPhotos[index] = newPhotos[index + 1];
    newPhotos[index + 1] = temp;

    const updates = newPhotos.map((photo, idx) => ({
      id: photo.id,
      order_index: idx + 1
    }));

    const result = await updateCoverPhotoOrder(updates);
    if (result.error === null) {
      setPhotos(newPhotos);
      setSuccessMessage('Photo order updated');
      setTimeout(() => setSuccessMessage(''), 3000);
    }
  };

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

      {/* Error Message */}
      {errorMessage && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg flex justify-between items-center">
          <span>{errorMessage}</span>
          <button
            onClick={() => setErrorMessage('')}
            className="text-red-600 hover:text-red-800"
          >
            ✕
          </button>
        </div>
      )}

      {/* Add Photo Button */}
      {!showUploadForm && (
        <button
          onClick={() => setShowUploadForm(true)}
          className="flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
        >
          <FiUpload size={20} />
          Add New Cover Photo
        </button>
      )}

      {/* Upload Form */}
      {showUploadForm && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Cover Photo</h3>

          {/* Upload Mode Toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setUploadMode('file')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition font-medium ${
                uploadMode === 'file'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <FiImage size={18} />
              Upload File
            </button>
            <button
              onClick={() => setUploadMode('url')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition font-medium ${
                uploadMode === 'url'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <FiLink size={18} />
              Image URL
            </button>
          </div>

          <div className="space-y-4">
            {/* File Upload Mode */}
            {uploadMode === 'file' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Image File
                </label>
                <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                  <p className="text-sm text-blue-800">
                    <strong>Minimum size:</strong> {COVER_BANNER_GUIDANCE.minimumWidth}x{COVER_BANNER_GUIDANCE.minimumHeight}px
                  </p>
                  <p className="text-sm text-blue-800 mt-1">
                    <strong>Recommended:</strong> {COVER_BANNER_GUIDANCE.recommendedWidth}x{COVER_BANNER_GUIDANCE.recommendedHeight}px or larger in a wide banner ratio.
                  </p>
                  <p className="text-sm text-blue-800 mt-1">
                    <strong>Auto-optimization:</strong> Uploads are converted to high-quality WebP and sized for homepage hero use.
                  </p>
                </div>
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-primary-500 transition cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div className="space-y-2">
                      <FiImage className="mx-auto text-primary-600" size={40} />
                      <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedFile(null);
                          setFilePreview(null);
                          setUploadInfoMessage('');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-red-600 text-sm hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <FiUpload className="mx-auto text-gray-400" size={40} />
                      <p className="text-sm text-gray-600">
                        Click to select an image or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">
                        PNG, JPG, or WEBP. Wide banners work best.
                      </p>
                    </div>
                  )}
                </div>
                {uploadInfoMessage ? (
                  <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {uploadInfoMessage}
                  </div>
                ) : null}
              </div>
            )}

            {/* URL Input Mode */}
            {uploadMode === 'url' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image URL
                </label>
                <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> Direct URLs are not automatically optimized. For the sharpest homepage banner, use file upload instead.
                  </p>
                  <p className="text-sm text-yellow-800 mt-1">
                    Recommended banner size: {COVER_BANNER_GUIDANCE.recommendedWidth}x{COVER_BANNER_GUIDANCE.recommendedHeight}px or larger.
                  </p>
                </div>
                <input
                  type="url"
                  placeholder="https://example.com/image.jpg"
                  value={newPhotoUrl}
                  onChange={(e) => setNewPhotoUrl(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                />
                <p className="text-sm text-gray-600 mt-2">
                  Enter the complete URL of the image you want to use
                </p>
              </div>
            )}

            {/* Preview */}
            {(filePreview || newPhotoUrl) && (
              <div className="mt-4">
                <p className="text-sm font-medium text-gray-700 mb-2">Preview</p>
                <div className="aspect-[16/5] overflow-hidden rounded-lg border bg-gray-100">
                  <img
                    src={uploadMode === 'file' ? filePreview : newPhotoUrl}
                    alt="Preview"
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={handleAddPhoto}
                disabled={uploading}
                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
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
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-900 rounded-lg hover:bg-gray-300 transition font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photos Gallery */}
      {loading ? (
        <div className="bg-white rounded-lg shadow p-12 flex justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      ) : photos.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-600 text-lg mb-4">No cover photos yet</p>
          <button
            onClick={() => setShowUploadForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-medium"
          >
            <FiUpload size={20} />
            Add First Photo
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="bg-white rounded-lg shadow overflow-hidden hover:shadow-lg transition"
            >
              {/* Image */}
              <div className="relative aspect-[16/5] w-full bg-gray-200">
                <img
                  src={photo.image_url}
                  alt={`Cover ${index + 1}`}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src =
                      'https://via.placeholder.com/400x300?text=Image+Not+Found';
                  }}
                />
                {!photo.is_active && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <span className="text-white font-semibold">Inactive</span>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-600">
                    Order: {photo.order_index}
                  </span>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      photo.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {photo.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => handleToggleStatus(photo.id, photo.is_active)}
                    title={photo.is_active ? 'Deactivate' : 'Activate'}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition font-medium text-sm ${
                      photo.is_active
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {photo.is_active ? (
                      <>
                        <FiEyeOff size={16} />
                        Hide
                      </>
                    ) : (
                      <>
                        <FiEye size={16} />
                        Show
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => handleMoveUp(index)}
                    disabled={index === 0}
                    title="Move up in order"
                    className="flex items-center justify-center px-3 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiArrowUp size={16} />
                  </button>

                  <button
                    onClick={() => handleMoveDown(index)}
                    disabled={index === photos.length - 1}
                    title="Move down in order"
                    className="flex items-center justify-center px-3 py-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FiArrowDown size={16} />
                  </button>

                  <button
                    onClick={() => handleDeletePhoto(photo.id)}
                    title="Delete photo"
                    className="flex items-center justify-center px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                  >
                    <FiTrash2 size={16} />
                  </button>
                </div>

                {/* URL */}
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs text-gray-600 break-all hover:text-gray-900 cursor-text">
                    {photo.image_url}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CoverPhotoManagement;
