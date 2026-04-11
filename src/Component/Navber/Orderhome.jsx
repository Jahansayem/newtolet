import { useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { createPropertyInquiry } from "../../services/inquiryService";
import useHydratedSnapshot from "../../hooks/useHydratedSnapshot";
import { useAuth } from "../../hooks/useAuth";
import { getPropertyById, getPropertyByIdCacheKey } from "../../services/propertyService";

const Orderhome = () => {
    const [searchParams] = useSearchParams()
    const id = searchParams.get('id') || ''
    const { user, isLoading: isAuthLoading } = useAuth()
    const viewer = useMemo(() => ({
        viewerId: user?.id || null,
        canViewProtected: user?.is_admin === true
    }), [user?.id, user?.is_admin])
    const propertyCacheKey = useMemo(
        () => getPropertyByIdCacheKey(id, viewer),
        [id, viewer]
    )
    const {
        snapshot: cachedProperty,
        hasSnapshot: hasCachedProperty,
        isHydrated
    } = useHydratedSnapshot(propertyCacheKey)
    const [lists, setLists] = useState(null)
    const [loading, setLoading] = useState(true)
    const [submitting, setSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        message: ''
    })
    const [formSubmitted, setFormSubmitted] = useState(false)
    const [formError, setFormError] = useState(null)
    const [loadError, setLoadError] = useState(null)

    useEffect(() => {
        if (!isHydrated) {
            return
        }

        if (hasCachedProperty) {
            setLists(cachedProperty)
            setLoading(false)
        }
    }, [cachedProperty, hasCachedProperty, isHydrated])

    useEffect(() => {
        if (!isHydrated || isAuthLoading) {
            return
        }

        let isMounted = true

        const loadProperty = async () => {
            if (!id) {
                setLists(null)
                setLoadError('Property ID is missing.')
                setLoading(false)
                return
            }

            if (!hasCachedProperty) {
                setLoading(true)
            }

            setLoadError(null)

            try {
                const property = await getPropertyById(id, viewer)
                if (isMounted) {
                    setLists(property)
                }
            } catch (error) {
                console.error('Error loading inquiry property:', error)
                if (isMounted && !hasCachedProperty) {
                    setLists(null)
                    setLoadError('Property not found.')
                }
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        loadProperty()

        return () => {
            isMounted = false
        }
    }, [hasCachedProperty, id, isAuthLoading, isHydrated, viewer])

    const handleInputChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        setSubmitting(true)
        setFormError(null)

        try {
            const { error } = await createPropertyInquiry({
                propertyId: id,
                name: formData.name,
                email: formData.email,
                phone: formData.phone,
                message: formData.message
            })

            if (error) {
                throw error
            }

            setFormSubmitted(true)
            setFormData({ name: '', email: '', phone: '', message: '' })
            setTimeout(() => setFormSubmitted(false), 5000)
        } catch (error) {
            console.error('Error submitting inquiry:', error)
            setFormError('Failed to send message. Please try again.')
        } finally {
            setSubmitting(false)
        }
    }

    // Show loading state while data is being fetched
    if (loading || isAuthLoading) {
        return (
            <div className="min-h-screen bg-gray-50 py-12">
                <div className="max-w-6xl mx-auto px-4">
                    <div className="animate-pulse space-y-6">
                        <div className="h-12 bg-gray-200 rounded-xl w-1/3"></div>
                        <div className="h-96 bg-gray-200 rounded-2xl"></div>
                    </div>
                </div>
            </div>
        );
    }

    // Show error if property not found
    if (!lists || loadError) {
        return (
            <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center">
                <div className="bg-white border-2 border-red-200 rounded-2xl p-8 text-center shadow-xl max-w-md">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </div>
                    <p className="text-red-800 font-bold text-xl">Property not found</p>
                    <p className="text-red-600 text-sm mt-2">{loadError || "The property you're looking for doesn't exist."}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-12 px-4">
            <div className="max-w-6xl mx-auto">
                {/* Header Section */}
                <div className="text-center mb-12 animate-fade-in">
                    <h1 className="text-4xl font-bold text-gray-800 mb-4">
                        Contact Property Owner
                    </h1>
                    <p className="text-gray-600 text-lg">Get in touch to learn more about this amazing property</p>
                </div>

                <div className="grid lg:grid-cols-2 gap-8">
                    {/* Property Information Card */}
                    <div className="space-y-6">
                        {/* Property Details Card */}
                        <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100 hover:shadow-xl transition-all duration-300">
                            <div className="flex items-center mb-6">
                                <div className="w-12 h-12 bg-[#1E73B8] rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                    </svg>
                                </div>
                                <h3 className="font-bold text-2xl ml-4 text-gray-800">Property Location</h3>
                            </div>

                            {lists.location ? (
                                <div className="space-y-4">
                                    <div className="flex items-start p-4 bg-gray-50 rounded-xl">
                                        <svg className="w-5 h-5 text-primary-600 mt-1 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"></path>
                                        </svg>
                                        <div>
                                            <p className="text-sm font-medium text-gray-600">District</p>
                                            <p className="text-lg font-bold text-gray-800">{lists.location.state_district || 'N/A'}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start p-4 bg-gray-50 rounded-xl">
                                        <svg className="w-5 h-5 text-primary-600 mt-1 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"></path>
                                        </svg>
                                        <div>
                                            <p className="text-sm font-medium text-gray-600">Area</p>
                                            <p className="text-lg font-bold text-gray-800">{lists.location.area || 'N/A'}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-start p-4 bg-gray-50 rounded-xl">
                                        <svg className="w-5 h-5 text-primary-600 mt-1 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z"></path>
                                        </svg>
                                        <div>
                                            <p className="text-sm font-medium text-gray-600">Contact Number</p>
                                            <p className="text-lg font-bold text-gray-800">{lists.location.contact_number || 'N/A'}</p>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center py-8">Location information not available</p>
                            )}
                        </div>

                        {/* Quick Info Card */}
                        <div className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl shadow-xl p-8 text-white">
                            <h4 className="font-bold text-xl mb-4">Why Contact Us?</h4>
                            <ul className="space-y-3">
                                <li className="flex items-center">
                                    <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                                    </svg>
                                    Fast response within 24 hours
                                </li>
                                <li className="flex items-center">
                                    <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                                    </svg>
                                    Schedule property viewing
                                </li>
                                <li className="flex items-center">
                                    <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                                    </svg>
                                    Get detailed information
                                </li>
                                <li className="flex items-center">
                                    <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                                    </svg>
                                    Professional assistance
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* Contact Form Card */}
                    <div className="bg-white rounded-2xl shadow-xl p-8 border border-purple-100 hover:shadow-2xl transition-all duration-300">
                        <div className="flex items-center mb-6">
                            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                                </svg>
                            </div>
                            <h3 className="font-bold text-2xl ml-4 text-gray-800">Send a Message</h3>
                        </div>

                        {formSubmitted && (
                            <div className="mb-6 p-4 bg-green-50 border-l-4 border-green-500 rounded-lg">
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 text-green-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"></path>
                                    </svg>
                                    <p className="text-green-700 font-medium">Message sent successfully! We'll get back to you soon.</p>
                                </div>
                            </div>
                        )}

                        {formError && (
                            <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-lg">
                                <div className="flex items-center">
                                    <svg className="w-5 h-5 text-red-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"></path>
                                    </svg>
                                    <p className="text-red-700 font-medium">{formError}</p>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div>
                                <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                                    placeholder="Enter your full name"
                                />
                            </div>

                            <div>
                                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                                    placeholder="your.email@example.com"
                                />
                            </div>

                            <div>
                                <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Phone Number
                                </label>
                                <input
                                    type="tel"
                                    id="phone"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleInputChange}
                                    required
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all"
                                    placeholder="+1 (123) 456-7890"
                                />
                            </div>

                            <div>
                                <label htmlFor="message" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Your Message
                                </label>
                                <textarea
                                    id="message"
                                    name="message"
                                    value={formData.message}
                                    onChange={handleInputChange}
                                    required
                                    rows="5"
                                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all resize-none"
                                    placeholder="I'm interested in this property and would like to know more about..."
                                ></textarea>
                            </div>

                            <button
                                type="submit"
                                disabled={submitting}
                                className={`w-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 text-white font-bold py-4 px-6 rounded-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 flex items-center justify-center space-x-2 ${submitting ? 'opacity-70 cursor-not-allowed' : ''}`}
                            >
                                {submitting ? (
                                    <>
                                        <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span>Sending...</span>
                                    </>
                                ) : (
                                    <>
                                        <span>Send Message</span>
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                                        </svg>
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <p className="text-sm text-gray-500 text-center">
                                By submitting this form, you agree to our terms and privacy policy
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Orderhome;
