import React, { useState, useEffect, useContext } from 'react';
import { FiCreditCard, FiPhone, FiLock, FiCheckCircle, FiAlertCircle } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import { getCreditPackages, getPaymentGateways, createPaymentTransaction, completePayment } from '../../services/paymentService';
import { getUserCredits } from '../../services/creditService';
import { supabase } from '../../services/supabaseClient';

const BuyCredits = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [currentCredits, setCurrentCredits] = useState(0);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [step, setStep] = useState(1); // 1: Phone, 2: Package, 3: Payment, 4: Confirm
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isBlacklisted, setIsBlacklisted] = useState(false);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [transactionId, setTransactionId] = useState('');
  const [packages, setPackages] = useState([]);

  const paymentGateways = getPaymentGateways();

  useEffect(() => {
    const loadPackages = async () => {
      const packageData = await getCreditPackages();
      setPackages(packageData || []);
    };

    loadPackages();
  }, []);

  useEffect(() => {
    if (!user) return;

    fetchCredits();
    // Pre-fill phone if user has one
    if (user.phone) {
      setPhoneNumber(user.phone);
      setPhoneVerified(true);
    }
  }, [user]);

  const fetchCredits = async () => {
    if (user) {
      const credits = await getUserCredits(user.id);
      setCurrentCredits(credits);
    }
  };

  const checkBlacklistStatus = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('user_blacklist')
        .select('reason, notes')
        .eq('user_id', userId)
        .order('blacklisted_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setIsBlacklisted(true);
        setBlacklistReason(data.reason || 'Account restricted');
        return true;
      }
      return false;
    } catch (err) {
      // Table might not exist or no blacklist entry
      return false;
    }
  };

  const validatePhone = (phone) => {
    // Bangladeshi phone validation
    const bdPhoneRegex = /^(\+880|880)?(1[3-9]\d{8})$/;
    return bdPhoneRegex.test(phone.replace(/\s/g, ''));
  };

  const formatPhone = (phone) => {
    // Format to +880 format
    let formatted = phone.replace(/\s/g, '');
    if (formatted.startsWith('01')) {
      formatted = '+880' + formatted;
    } else if (formatted.startsWith('880')) {
      formatted = '+' + formatted;
    }
    return formatted;
  };

  const handlePhoneSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (!validatePhone(phoneNumber)) {
      setError('Please enter a valid Bangladeshi phone number (e.g., 017XXXXXXXX or +88017XXXXXXXX)');
      setLoading(false);
      return;
    }

    const formattedPhone = formatPhone(phoneNumber);

    try {
      // Check if phone exists in users table
      const { data: existingUser, error } = await supabase
        .from('users')
        .select('id, is_active, phone')
        .eq('phone', formattedPhone)
        .maybeSingle();

      if (error) throw error;

      if (!existingUser) {
        setError('This phone number is not registered. Please register first.');
        setLoading(false);
        return;
      }

      if (!existingUser.is_active) {
        setError('This account has been blocked. Please contact support.');
        setLoading(false);
        return;
      }

      // Check blacklist status
      const blacklisted = await checkBlacklistStatus(existingUser.id);
      if (blacklisted) {
        setError(`Account restricted: ${blacklistReason}. You cannot purchase credits.`);
        setLoading(false);
        return;
      }

      setPhoneVerified(true);
      setStep(2);
    } catch (err) {
      setError('Failed to verify phone number. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePackageSelect = (pkg) => {
    setSelectedPackage(pkg);
    setStep(3);
  };

  const handlePaymentSelect = (method) => {
    setSelectedPayment(method);
    setStep(4);
  };

  const handleConfirmPurchase = async () => {
    if (!user) {
      setError('Please log in to continue.');
      return;
    }

    setProcessingPayment(true);
    setError('');

    try {
      // Final blacklist check
      const blacklisted = await checkBlacklistStatus(user.id);
      if (blacklisted) {
        setError(`Account restricted: ${blacklistReason}. Cannot complete purchase.`);
        setProcessingPayment(false);
        return;
      }

      // Create transaction
      const { data: transaction, error: transError } = await createPaymentTransaction(
        user.id,
        selectedPackage.id,
        selectedPayment.id
      );

      if (transError) throw transError;

      setTransactionId(transaction.transaction_id);

      // Simulate payment gateway (in production, redirect to actual gateway)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Complete payment
      const { error: completeError } = await completePayment(transaction.transaction_id);

      if (completeError) throw completeError;

      setSuccess(true);
      await fetchCredits();

      // Reset after 3 seconds
      setTimeout(() => {
        setSuccess(false);
        setStep(1);
        setSelectedPackage(null);
        setSelectedPayment(null);
        setTransactionId('');
      }, 3000);

    } catch (err) {
      setError(err.message || 'Payment failed. Please try again.');
    } finally {
      setProcessingPayment(false);
    }
  };

  const calculateDiscount = (pkg) => {
    if (!pkg.discount) return pkg.price;
    return pkg.price - (pkg.price * pkg.discount / 100);
  };

  if (isBlacklisted && step !== 1) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiLock className="text-red-600 text-2xl" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Account Restricted</h2>
          <p className="text-gray-600 mb-6">{blacklistReason}</p>
          <p className="text-sm text-gray-500">Please contact support for assistance.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Buy Credits</h1>
              <p className="text-gray-600">Purchase credits to list properties and unlock features</p>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          {/* Current Credits */}
          <div className="mt-4 bg-gradient-to-r from-gray-800 to-gray-900 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FiCreditCard className="text-white text-xl" />
              <span className="text-gray-200 font-medium">Your Balance</span>
            </div>
            <span className="text-3xl font-bold text-white">{currentCredits}</span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <FiAlertCircle />
            <span>{error}</span>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <FiCheckCircle />
            <span>Successfully purchased {selectedPackage?.credits} credits!</span>
          </div>
        )}

        {/* Step 1: Phone Verification */}
        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-gray-900 font-bold">1</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Verify Phone Number</h2>
            </div>

            <form onSubmit={handlePhoneSubmit}>
              <div className="relative mb-4">
                <FiPhone className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  placeholder="Enter phone number (e.g., 017XXXXXXXX)"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-gray-500 focus:border-transparent text-lg"
                />
              </div>

              <p className="text-sm text-gray-500 mb-6">
                Enter your registered Bangladeshi phone number to continue
              </p>

              <button
                type="submit"
                disabled={loading || !phoneNumber}
                className="w-full py-4 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Continue'}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Select Package */}
        {step === 2 && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-gray-900 font-bold">2</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Select Credit Package</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {packages.map((pkg) => {
                const finalPrice = calculateDiscount(pkg);
                const isPopular = pkg.popular;

                return (
                  <div
                    key={pkg.id}
                    onClick={() => handlePackageSelect(pkg)}
                    className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all ${
                      isPopular
                        ? 'border-gray-900 bg-gray-100 ring-2 ring-gray-300'
                        : 'border-gray-200 hover:border-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    {isPopular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs font-bold px-3 py-1 rounded-full">
                        POPULAR
                      </span>
                    )}

                    <h3 className="text-lg font-bold text-gray-900">{pkg.name}</h3>
                    <div className="mt-2">
                      <span className="text-3xl font-bold text-black">{pkg.credits}</span>
                      <span className="text-gray-600 ml-1">credits</span>
                    </div>

                    <div className="mt-4">
                      {pkg.discount > 0 ? (
                        <div>
                          <span className="text-gray-400 line-through text-sm">৳{pkg.price}</span>
                          <span className="text-xl font-bold text-gray-900 ml-2">৳{finalPrice}</span>
                          <span className="ml-2 text-gray-700 text-sm font-semibold">{pkg.discount}% OFF</span>
                        </div>
                      ) : (
                        <span className="text-xl font-bold text-gray-900">৳{pkg.price}</span>
                      )}
                    </div>

                    <div className="mt-2 text-sm text-gray-500">
                      ৳{(finalPrice / pkg.credits).toFixed(2)} per credit
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => setStep(1)}
              className="mt-6 text-gray-600 hover:text-gray-800 font-medium"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Step 3: Select Payment Method */}
        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-gray-900 font-bold">3</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Select Payment Method</h2>
            </div>

            {/* Selected Package Summary */}
            <div className="bg-gray-50 rounded-xl p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Selected Package:</span>
                <div className="text-right">
                  <span className="font-bold text-gray-900">{selectedPackage.name}</span>
                  <span className="text-gray-900 font-bold ml-2">{selectedPackage.credits} credits</span>
                </div>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-600">Amount to Pay:</span>
                <span className="text-xl font-bold text-gray-900">
                  ৳{calculateDiscount(selectedPackage)}
                </span>
              </div>
            </div>

            {/* Payment Methods */}
            <div className="space-y-3">
              {paymentGateways.map((gateway) => (
                <div
                  key={gateway.id}
                  onClick={() => handlePaymentSelect(gateway)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all flex items-center gap-4 ${
                    selectedPayment?.id === gateway.id
                      ? 'border-gray-900 bg-gray-100'
                      : 'border-gray-200 hover:border-gray-900'
                  }`}
                >
                  <span className="text-2xl">{gateway.icon}</span>
                  <span className="font-semibold text-gray-900">{gateway.name}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setStep(2)}
              className="mt-6 text-gray-600 hover:text-gray-800 font-medium"
            >
              ← Back
            </button>
          </div>
        )}

        {/* Step 4: Confirm Purchase */}
        {step === 4 && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-gray-900 font-bold">4</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">Confirm Purchase</h2>
            </div>

            {/* Order Summary */}
            <div className="bg-gray-50 rounded-xl p-6 space-y-4 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">Package:</span>
                <span className="font-semibold">{selectedPackage.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Credits:</span>
                <span className="font-semibold">{selectedPackage.credits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Payment Method:</span>
                <span className="font-semibold flex items-center gap-2">
                  {selectedPayment.icon} {selectedPayment.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Phone:</span>
                <span className="font-semibold">{formatPhone(phoneNumber)}</span>
              </div>
              <div className="border-t pt-4 flex justify-between">
                <span className="text-gray-900 font-semibold">Total Amount:</span>
                <span className="text-xl font-bold text-gray-900">
                  ৳{calculateDiscount(selectedPackage)}
                </span>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setStep(3)}
                className="flex-1 py-4 bg-gray-200 text-gray-900 rounded-xl font-semibold hover:bg-gray-300 transition"
              >
                Back
              </button>
              <button
                onClick={handleConfirmPurchase}
                disabled={processingPayment}
                className="flex-1 py-4 bg-gray-900 text-white rounded-xl font-semibold hover:bg-gray-800 transition disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {processingPayment ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing...
                  </>
                ) : (
                  `Pay ৳${calculateDiscount(selectedPackage)}`
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BuyCredits;
