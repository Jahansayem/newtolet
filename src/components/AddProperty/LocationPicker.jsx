import React, { useState } from 'react'

const LocationPicker = ({
  onSelect,
  onClose,
  initialLat = null,
  initialLng = null,
}) => {
  const [lat, setLat] = useState(initialLat || '')
  const [lng, setLng] = useState(initialLng || '')
  const [searchAddress, setSearchAddress] = useState('')
  const [loading, setLoading] = useState(false)

  // Bangladesh default coordinates
  const DEFAULT_LAT = 23.8103
  const DEFAULT_LNG = 90.4125

  // Preset locations (all major areas in Bangladesh)
  const presetLocations = [
    // Dhaka Division
    { name: 'Dhaka Center', lat: 23.8103, lng: 90.4125 },
    { name: 'Uttara', lat: 23.8771, lng: 90.3746 },
    { name: 'Dhanmondi', lat: 23.7425, lng: 90.3666 },
    { name: 'Mirpur', lat: 23.8231, lng: 90.3597 },
    { name: 'Mohakhali', lat: 23.7894, lng: 90.4216 },
    { name: 'Motijheel', lat: 23.7458, lng: 90.4065 },
    { name: 'Gulshan', lat: 23.8103, lng: 90.4314 },
    { name: 'Banani', lat: 23.8243, lng: 90.4193 },
    { name: 'Baridhara', lat: 23.8321, lng: 90.4211 },
    { name: 'Bashundhara', lat: 23.8121, lng: 90.4286 },
    { name: 'Paltan', lat: 23.7359, lng: 90.3979 },
    { name: 'Farmgate', lat: 23.7585, lng: 90.3894 },
    { name: 'Shahbagh', lat: 23.7486, lng: 90.3969 },
    { name: 'Ramna', lat: 23.7391, lng: 90.3978 },
    { name: 'Tejgaon', lat: 23.7569, lng: 90.3934 },
    { name: 'Baily Road', lat: 23.7405, lng: 90.3982 },
    { name: 'Elephant Road', lat: 23.7443, lng: 90.3945 },
    { name: 'New Market', lat: 23.7345, lng: 90.3891 },
    { name: 'Azimpur', lat: 23.7231, lng: 90.3876 },
    { name: 'Lalbagh', lat: 23.7185, lng: 90.3885 },
    { name: 'Kakrail', lat: 23.7458, lng: 90.4012 },
    { name: 'Siddheswari', lat: 23.7534, lng: 90.4089 },
    { name: 'Moghbazar', lat: 23.7498, lng: 90.4056 },
    { name: 'Wari', lat: 23.7156, lng: 90.4023 },
    { name: 'Tanti Bazar', lat: 23.7123, lng: 90.4056 },
    { name: 'Nawabpur', lat: 23.7145, lng: 90.4089 },
    { name: 'Bakshi Bazar', lat: 23.7198, lng: 90.4012 },
    { name: 'Islampur', lat: 23.7212, lng: 90.4045 },
    { name: 'Patuapara', lat: 23.7245, lng: 90.4078 },
    { name: 'Bangshal', lat: 23.7234, lng: 90.4112 },
    { name: 'Milan Bazar', lat: 23.7267, lng: 90.4034 },
    { name: 'Kotwali', lat: 23.7178, lng: 90.4067 },
    { name: 'Chawkbazar', lat: 23.7156, lng: 90.4034 },
    { name: 'Sadarghat', lat: 23.7112, lng: 90.4089 },
    { name: 'Armanitola', lat: 23.7189, lng: 90.4023 },
    { name: 'Sutrapur', lat: 23.7289, lng: 90.4156 },
    { name: 'Gendaria', lat: 23.7301, lng: 90.4045 },
    { name: 'Waisghat', lat: 23.7234, lng: 90.4012 },
    { name: 'Laxmibazar', lat: 23.7312, lng: 90.4078 },
    { name: 'Hazaribagh', lat: 23.7456, lng: 90.3812 },
    { name: 'Kamrangirchar', lat: 23.7212, lng: 90.3789 },
    { name: 'Keraniganj', lat: 23.6989, lng: 90.3789 },
    { name: 'Savar', lat: 23.8567, lng: 90.2545 },
    { name: 'Ashulia', lat: 23.9045, lng: 90.2367 },
    { name: 'Gazipur', lat: 23.9998, lng: 90.4234 },
    { name: 'Tongi', lat: 23.8923, lng: 90.4034 },
    { name: 'Narayanganj', lat: 23.6238, lng: 90.4989 },
    { name: 'Siddhirganj', lat: 23.6456, lng: 90.5234 },
    { name: 'Narsingdi', lat: 23.9234, lng: 90.7189 },
    { name: 'Manikganj', lat: 23.8567, lng: 89.9456 },
    { name: 'Tangail', lat: 24.2513, lng: 89.9167 },
    { name: 'Kishoreganj', lat: 24.4456, lng: 90.7789 },
    { name: 'Munshiganj', lat: 23.5434, lng: 90.5345 },
    { name: 'Rajbari', lat: 23.7567, lng: 89.6456 },
    { name: 'Madaripur', lat: 23.1656, lng: 90.1890 },
    { name: 'Gopalganj', lat: 22.9890, lng: 89.9234 },
    { name: 'Faridpur', lat: 23.6078, lng: 89.8345 },
    { name: 'Shariatpur', lat: 23.2134, lng: 90.3789 },

    // Chittagong Division
    { name: 'Chittagong', lat: 22.3569, lng: 91.7832 },
    { name: 'Agrabad', lat: 22.3678, lng: 91.8234 },
    { name: 'GEC Circle', lat: 22.3590, lng: 91.8012 },
    { name: 'Halishahar', lat: 22.3890, lng: 91.8123 },
    { name: 'Pahartali', lat: 22.3789, lng: 91.8234 },
    { name: 'Chawkbazar', lat: 22.3456, lng: 91.8345 },
    { name: 'Andarkilla', lat: 22.3567, lng: 91.8234 },
    { name: 'Patharghata', lat: 22.3678, lng: 91.8123 },
    { name: 'KB Fazlul Kader Road', lat: 22.3712, lng: 91.8012 },
    { name: 'Jamboree Field', lat: 22.3823, lng: 91.7912 },
    { name: 'Cox\'s Bazar', lat: 21.4272, lng: 92.0058 },
    { name: 'Comilla', lat: 23.4607, lng: 91.1809 },
    { name: 'Feni', lat: 23.0123, lng: 91.3890 },
    { name: 'Brahmanbaria', lat: 23.9570, lng: 90.7512 },
    { name: 'Rangamati', lat: 22.6342, lng: 92.1956 },
    { name: 'Bandarban', lat: 22.1956, lng: 92.2345 },
    { name: 'Khagrachari', lat: 23.1234, lng: 91.9567 },
    { name: 'Noakhali', lat: 22.8678, lng: 91.0912 },
    { name: 'Lakshmipur', lat: 22.9456, lng: 90.8234 },
    { name: 'Chandpur', lat: 23.2345, lng: 90.6567 },
    { name: 'Chattogram Hill Tracts', lat: 22.5678, lng: 92.1234 },

    // Rajshahi Division
    { name: 'Rajshahi', lat: 24.3636, lng: 88.5861 },
    { name: 'Paba', lat: 24.3789, lng: 88.6123 },
    { name: 'Mohanpur', lat: 24.4567, lng: 88.6234 },
    { name: 'Godagari', lat: 24.4567, lng: 88.3789 },
    { name: 'Bagha', lat: 24.2345, lng: 88.5456 },
    { name: 'Charghat', lat: 24.2890, lng: 88.6567 },
    { name: 'Puthia', lat: 24.3789, lng: 88.5890 },
    { name: 'Durgapur', lat: 24.4123, lng: 88.6789 },
    { name: 'Bogra', lat: 24.8466, lng: 89.3787 },
    { name: 'Joypurhat', lat: 25.1234, lng: 89.0234 },
    { name: 'Naogaon', lat: 24.8234, lng: 88.9456 },
    { name: 'Natore', lat: 24.4123, lng: 88.9890 },
    { name: 'Chapainawabganj', lat: 24.5678, lng: 88.2789 },
    { name: 'Sirajganj', lat: 24.4567, lng: 89.7012 },
    { name: 'Pabna', lat: 23.9890, lng: 89.2345 },
    { name: 'Rajshahi University', lat: 24.3734, lng: 88.6234 },

    // Khulna Division
    { name: 'Khulna', lat: 22.8456, lng: 89.5403 },
    { name: 'Shibbari', lat: 22.8567, lng: 89.5567 },
    { name: 'Khalishpur', lat: 22.8345, lng: 89.5234 },
    { name: 'Sonadanga', lat: 22.8234, lng: 89.5678 },
    { name: 'Jessore', lat: 23.1656, lng: 89.2123 },
    { name: 'Satkhira', lat: 22.7189, lng: 89.0789 },
    { name: 'Meherpur', lat: 23.7567, lng: 88.9456 },
    { name: 'Narail', lat: 23.1678, lng: 89.5012 },
    { name: 'Chuadanga', lat: 23.6456, lng: 88.8345 },
    { name: 'Jhenaidah', lat: 23.5456, lng: 89.1567 },
    { name: 'Magura', lat: 23.4890, lng: 89.4123 },
    { name: 'Kushtia', lat: 23.9012, lng: 89.1234 },
    { name: 'Bagerhat', lat: 22.6512, lng: 89.7834 },
    { name: 'Benapole', lat: 23.0234, lng: 88.9890 },
    { name: 'Mongla', lat: 22.4567, lng: 89.5789 },
    { name: 'Sundarbans', lat: 22.1234, lng: 89.6234 },

    // Sylhet Division
    { name: 'Sylhet', lat: 24.9044, lng: 91.8607 },
    { name: 'Ambarkhana', lat: 24.9123, lng: 91.8712 },
    { name: 'Akhalia', lat: 24.8989, lng: 91.8567 },
    { name: 'Zindabazar', lat: 24.8912, lng: 91.8789 },
    { name: 'Bondor Bazar', lat: 24.8956, lng: 91.8834 },
    { name: 'Moulvibazar', lat: 24.4834, lng: 91.7789 },
    { name: 'Habiganj', lat: 24.3789, lng: 91.4123 },
    { name: 'Sunamganj', lat: 24.9123, lng: 91.3912 },
    { name: 'Sreemangal', lat: 24.3089, lng: 91.7234 },
    { name: 'Bishwanath', lat: 24.7890, lng: 91.7456 },
    { name: 'Beanibazar', lat: 24.9567, lng: 92.1789 },
    { name: 'Zakiganj', lat: 24.9890, lng: 92.2345 },
    { name: 'Dakshin Surma', lat: 24.8789, lng: 91.8456 },

    // Barisal Division
    { name: 'Barisal', lat: 22.7010, lng: 90.3531 },
    { name: 'Babuganj', lat: 22.6890, lng: 90.3234 },
    { name: 'Bakerganj', lat: 22.6567, lng: 90.3890 },
    { name: 'Patuakhali', lat: 22.3345, lng: 90.3234 },
    { name: 'Barguna', lat: 22.1656, lng: 90.1234 },
    { name: 'Bhola', lat: 22.6890, lng: 90.7789 },
    { name: 'Jhalokati', lat: 22.5456, lng: 90.1789 },
    { name: 'Pirojpur', lat: 22.5678, lng: 89.9890 },
    { name: 'Bhola Sadar', lat: 22.7012, lng: 90.7345 },
    { name: 'Kuakata', lat: 21.8234, lng: 90.1234 },

    // Rangpur Division
    { name: 'Rangpur', lat: 25.7439, lng: 89.2444 },
    { name: 'Dinajpur', lat: 25.6253, lng: 88.6451 },
    { name: 'Syedpur', lat: 25.7123, lng: 88.9012 },
    { name: 'Parbatipur', lat: 25.6567, lng: 88.9123 },
    { name: 'Gaibandha', lat: 25.3234, lng: 89.5456 },
    { name: 'Kurigram', lat: 25.8234, lng: 89.6456 },
    { name: 'Lalmonirhat', lat: 25.9890, lng: 89.4567 },
    { name: 'Nilphamari', lat: 25.9345, lng: 88.8567 },
    { name: 'Thakurgaon', lat: 26.0234, lng: 88.4567 },
    { name: 'Panchagarh', lat: 26.3456, lng: 88.5456 },
    { name: 'Tetulia', lat: 26.4567, lng: 88.3789 },

    // Mymensingh Division
    { name: 'Mymensingh', lat: 24.7471, lng: 90.4203 },
    { name: 'Muktagachha', lat: 24.7890, lng: 90.2678 },
    { name: 'Gaffargaon', lat: 24.7123, lng: 90.5456 },
    { name: 'Trishal', lat: 24.6234, lng: 90.3789 },
    { name: 'Bhaluka', lat: 24.8789, lng: 90.3789 },
    { name: 'Ishwarganj', lat: 24.8345, lng: 90.5012 },
    { name: 'Nandail', lat: 24.5678, lng: 90.6789 },
    { name: 'Jamalpur', lat: 24.9234, lng: 89.9567 },
    { name: 'Sherpur', lat: 25.0123, lng: 89.9890 },
    { name: 'Netrokona', lat: 24.8789, lng: 90.7234 },
    { name: 'Kishoreganj Sadar', lat: 24.4567, lng: 90.7890 },
    { name: 'Hossainpur', lat: 24.4234, lng: 90.7012 },
    { name: 'Pakundia', lat: 24.5123, lng: 90.6567 },
    { name: 'Katiadi', lat: 24.3789, lng: 90.8234 },
    { name: 'Bajitpur', lat: 24.2345, lng: 90.8567 },
    { name: 'Austagram', lat: 24.5678, lng: 91.0123 },
    { name: 'Itna', lat: 24.6234, lng: 91.0456 },
    { name: 'Mithamain', lat: 24.6789, lng: 91.0789 },
    { name: 'Nikli', lat: 24.7234, lng: 91.0234 },

    // Major Landmarks/Areas
    { name: 'Hazrat Shahjalal Intl Airport', lat: 23.8433, lng: 90.3978 },
    { name: 'Hazrat Shahjalal Mazar', lat: 24.9012, lng: 91.8890 },
    { name: 'Kuakata Sea Beach', lat: 21.8234, lng: 90.1234 },
    { name: 'Cox\'s Bazar Sea Beach', lat: 21.4345, lng: 92.0234 },
    { name: 'Srimangal Tea Garden', lat: 24.3067, lng: 91.7345 },
    { name: 'Sundarbans', lat: 22.1234, lng: 89.6234 },
    { name: 'Saint Martin Island', lat: 20.6123, lng: 92.3234 },
    { name: 'Jaflong', lat: 25.1234, lng: 91.8456 },
  ]

  // Add search/filter functionality
  const [searchPreset, setSearchPreset] = useState('')

  const filteredLocations = presetLocations.filter(loc =>
    loc.name.toLowerCase().includes(searchPreset.toLowerCase())
  )

  const handleSelectPreset = (presetLat, presetLng) => {
    setLat(presetLat)
    setLng(presetLng)
  }

  const handleConfirm = () => {
    if (!lat || !lng) {
      alert('Please select or enter coordinates')
      return
    }

    const latitude = parseFloat(lat)
    const longitude = parseFloat(lng)

    // Basic validation
    if (isNaN(latitude) || isNaN(longitude)) {
      alert('Invalid coordinates')
      return
    }

    if (latitude < -90 || latitude > 90) {
      alert('Latitude must be between -90 and 90')
      return
    }

    if (longitude < -180 || longitude > 180) {
      alert('Longitude must be between -180 and 180')
      return
    }

    onSelect(latitude, longitude)
  }

  // Address search placeholder
  const handleGeocodeSearch = () => {
    if (!searchAddress.trim()) {
      alert('Please enter an address')
      return
    }

    // This is a placeholder - address search requires geocoding API
    setLoading(true)
    setTimeout(() => {
      // For demo, just set a default location
      setLat(DEFAULT_LAT)
      setLng(DEFAULT_LNG)
      setLoading(false)
      alert(
        'Note: Full address search requires geocoding API integration. Using default location for now.'
      )
    }, 500)
  }

  // Generate map preview URL using OpenStreetMap (free, no API key)
  const getMapPreviewUrl = () => {
    if (!lat || !lng) return null

    const latitude = parseFloat(lat)
    const longitude = parseFloat(lng)
    // OpenStreetMap embed URL
    return `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01}%2C${latitude - 0.01}%2C${longitude + 0.01}%2C${latitude + 0.01}&layer=mapnik&marker=${latitude}%2C${longitude}`
  }

  const mapPreviewUrl = getMapPreviewUrl()

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4'>
      <div className='bg-white rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto'>
        {/* Header */}
        <div className='sticky top-0 bg-white border-b border-gray-200 p-4 flex items-center justify-between z-10'>
          <h3 className='text-xl font-bold text-gray-800'>Select Location</h3>
          <button
            onClick={onClose}
            className='text-gray-500 hover:text-gray-700'
          >
            <svg
              className='w-6 h-6'
              fill='currentColor'
              viewBox='0 0 20 20'
            >
              <path
                fillRule='evenodd'
                d='M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z'
                clipRule='evenodd'
              />
            </svg>
          </button>
        </div>

        <div className='p-4 space-y-4'>
          {/* Address Search */}
          <div>
            <label className='block text-sm font-semibold text-gray-700 mb-2'>
              Search Address
            </label>
            <div className='flex gap-2'>
              <input
                type='text'
                value={searchAddress}
                onChange={(e) => setSearchAddress(e.target.value)}
                className='flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                placeholder='e.g., Uttara Sector 7, Dhaka'
              />
              <button
                onClick={handleGeocodeSearch}
                disabled={loading}
                className='px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-400'
              >
                {loading ? '...' : 'Search'}
              </button>
            </div>
            <p className='text-xs text-gray-500 mt-1'>
              Use preset locations or enter coordinates manually
            </p>
          </div>

          {/* Preset Locations */}
          <div>
            <label className='block text-sm font-semibold text-gray-700 mb-2'>
              Quick Select Locations (All Bangladesh)
            </label>
            <input
              type='text'
              value={searchPreset}
              onChange={(e) => setSearchPreset(e.target.value)}
              className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3'
              placeholder='Search location...'
            />
            <div className='max-h-48 overflow-y-auto border border-gray-200 rounded-lg p-2 grid grid-cols-2 gap-2'>
              {filteredLocations.length > 0 ? (
                filteredLocations.map((location) => (
                  <button
                    key={`${location.lat}-${location.lng}`}
                    onClick={() =>
                      handleSelectPreset(location.lat, location.lng)
                    }
                    className={`p-2 rounded-lg border-2 text-sm font-medium transition-all ${
                      lat === location.lat && lng === location.lng
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-blue-300'
                    }`}
                  >
                    {location.name}
                  </button>
                ))
              ) : (
                <div className='col-span-2 text-center text-gray-500 py-4'>
                  No locations found
                </div>
              )}
            </div>
            <p className='text-xs text-gray-500 mt-1'>
              Showing {filteredLocations.length} of {presetLocations.length} locations
            </p>
          </div>

          {/* Manual Coordinates */}
          <div>
            <label className='block text-sm font-semibold text-gray-700 mb-2'>
              Manual Coordinates
            </label>
            <div className='grid grid-cols-2 gap-3'>
              <div>
                <label className='block text-xs text-gray-600 mb-1'>
                  Latitude
                </label>
                <input
                  type='number'
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='e.g., 23.8103'
                  step='0.0001'
                  min='-90'
                  max='90'
                />
              </div>
              <div>
                <label className='block text-xs text-gray-600 mb-1'>
                  Longitude
                </label>
                <input
                  type='number'
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className='w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500'
                  placeholder='e.g., 90.4125'
                  step='0.0001'
                  min='-180'
                  max='180'
                />
              </div>
            </div>
            <p className='text-xs text-gray-500 mt-2'>
              Get coordinates from{' '}
              <a
                href='https://maps.google.com'
                target='_blank'
                rel='noopener noreferrer'
                className='text-blue-500 hover:underline'
              >
                Google Maps
              </a>
              {' '}(right-click on location)
            </p>
          </div>

          {/* Map Preview */}
          {lat && lng && (
            <div>
              <label className='block text-sm font-semibold text-gray-700 mb-2'>
                Location Preview
              </label>
              {mapPreviewUrl ? (
                <div className='rounded-lg overflow-hidden border border-gray-200' style={{ height: '200px' }}>
                  <iframe
                    src={mapPreviewUrl}
                    title='Location preview'
                    className='w-full h-full'
                    style={{ border: 0 }}
                    allowFullScreen
                    loading='lazy'
                    referrerPolicy='no-referrer-when-downgrade'
                  />
                </div>
              ) : (
                <div className='bg-gray-100 rounded-lg p-4 text-center text-gray-500 text-sm'>
                  Map preview not available
                </div>
              )}
              <div className='mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3'>
                <p className='text-sm text-blue-800'>
                  <strong>Selected:</strong> {parseFloat(lat).toFixed(4)}, {parseFloat(lng).toFixed(4)}
                </p>
              </div>
            </div>
          )}

          {/* Info */}
          <div className='bg-amber-50 border border-amber-200 rounded-lg p-3'>
            <p className='text-xs text-amber-800'>
              <strong>Tip:</strong> Precise location helps tenants find your
              property easily on the map.
            </p>
          </div>

          {/* Buttons */}
          <div className='flex gap-3'>
            <button
              onClick={onClose}
              className='flex-1 px-4 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50'
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              className='flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 disabled:bg-gray-400'
              disabled={!lat || !lng}
            >
              Confirm Location
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LocationPicker
