import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { FiAlertCircle, FiCreditCard, FiLock, FiX } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../contexts/AuthContext';
import { getCreditPackages, getPaymentGateways, createPaymentTransaction } from '../../services/paymentService';
import { getUserCredits } from '../../services/creditService';
import { supabase } from '../../services/supabaseClient';
import { useLanguage } from '../../i18n/useLanguage';
import { translate, readStoredLanguage } from '../../i18n';
import LanguageToggle from '../../components/LanguageToggle.jsx';

const BuyCredits = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [currentCredits, setCurrentCredits] = useState(0);
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [packagesLoading, setPackagesLoading] = useState(true);
  const [step, setStep] = useState(1); // 1: Package, 2: Payment, 3: Confirm
  const [error, setError] = useState('');
  const [isBlacklisted, setIsBlacklisted] = useState(false);
  const [blacklistReason, setBlacklistReason] = useState('');
  const [packages, setPackages] = useState([]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const paymentGateways = useMemo(() => getPaymentGateways(), []);

  const fetchCredits = useCallback(async () => {
    if (!user) {
      return;
    }

    const credits = await getUserCredits(user.id);
    if (isMountedRef.current) {
      setCurrentCredits(credits);
    }
  }, [user]);

  useEffect(() => {
    let isMounted = true;

    const loadPackages = async () => {
      setPackagesLoading(true);
      try {
        const packageData = await getCreditPackages();
        if (isMounted && isMountedRef.current) {
          setPackages(packageData || []);
        }
      } catch (loadError) {
        if (isMounted && isMountedRef.current) {
          setError(loadError.message || translate(readStoredLanguage(), 'payments.packages.errors.loadFailed'));
        }
      } finally {
        if (isMounted && isMountedRef.current) {
          setPackagesLoading(false);
        }
      }
    };

    void loadPackages();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    void fetchCredits();
  }, [fetchCredits, user]);

  const getDefaultPaymentMethod = useCallback(
    () => paymentGateways[0] || null,
    [paymentGateways]
  );

  const checkBlacklistStatus = useCallback(async (userId) => {
    try {
      const { data } = await supabase
        .from('user_blacklist')
        .select('reason, notes')
        .eq('user_id', userId)
        .order('blacklisted_at', { ascending: false })
        .limit(1)
        .single();

      if (data && isMountedRef.current) {
        setIsBlacklisted(true);
        setBlacklistReason(data.reason || t('payments.packages.restricted.defaultReason'));
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [t]);

  const handlePackageSelect = (pkg) => {
    setSelectedPackage(pkg);
    setSelectedPayment(getDefaultPaymentMethod());
    setError('');
    setStep(3);
  };

  const handleConfirmPurchase = async () => {
    if (!user) {
      setError(t('payments.packages.errors.loginRequired'));
      return;
    }

    if (!selectedPackage || !selectedPayment) {
      setError(t('payments.packages.errors.selectionRequired'));
      return;
    }

    setProcessingPayment(true);
    setError('');

    try {
      const blacklisted = await checkBlacklistStatus(user.id);
      if (blacklisted) {
        setError(
          t('payments.packages.restricted.purchaseBlocked', {
            reason: blacklistReason || t('payments.packages.restricted.defaultReason'),
          })
        );
        setProcessingPayment(false);
        return;
      }

      const { data: checkout, error: checkoutError } = await createPaymentTransaction(
        selectedPackage.id,
        {
          paymentMethod: selectedPayment.id,
        }
      );

      if (checkoutError || !checkout?.payment_url) {
        throw checkoutError || new Error(t('payments.packages.errors.checkoutFailed'));
      }

      window.location.assign(checkout.payment_url);
    } catch (err) {
      if (isMountedRef.current) {
        const message = err.message || t('payments.packages.errors.continueFailed');
        setError(
          message.includes('EPS_')
            ? t('payments.packages.errors.notConfigured')
            : message
        );
      }
    } finally {
      if (isMountedRef.current) {
        setProcessingPayment(false);
      }
    }
  };

  const calculateDiscount = (pkg) => {
    if (!pkg.discount) return Number(pkg.price || 0);
    return Number(pkg.price || 0) - (Number(pkg.price || 0) * Number(pkg.discount || 0)) / 100;
  };

  if (isBlacklisted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <LanguageToggle size="sm" className="absolute right-4 top-4" />
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiLock className="text-red-600 text-2xl" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('payments.packages.restricted.title')}</h2>
          <p className="text-gray-600 mb-6">{blacklistReason}</p>
          <p className="text-sm text-gray-500">{t('payments.packages.restricted.contactSupport')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{t('payments.packages.title')}</h1>
              <p className="text-gray-600">{t('payments.packages.subtitle')}</p>
            </div>
            <div className="flex items-center gap-3">
              <LanguageToggle size="sm" />
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="ui-btn ui-btn-ghost ui-btn-icon text-muted"
                aria-label={t('common.close')}
              >
                <FiX className="text-xl" aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between rounded-xl bg-ink p-4">
            <div className="flex items-center gap-3">
              <FiCreditCard className="text-white text-xl" />
              <span className="text-gray-200 font-medium">{t('payments.packages.yourBalance')}</span>
            </div>
            <span className="text-3xl font-bold text-white">{currentCredits}</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
            <FiAlertCircle />
            <span>{error}</span>
          </div>
        )}

        {step === 1 && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-gray-900 font-bold">1</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">{t('payments.packages.selectPackage')}</h2>
            </div>

            {packagesLoading ? (
              <p className="text-gray-600">{t('payments.packages.loading')}</p>
            ) : packages.length === 0 ? (
              <p className="text-gray-600">{t('payments.packages.empty')}</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {packages.map((pkg) => {
                  const finalPrice = calculateDiscount(pkg);
                  const isPopular = pkg.popular;

                  return (
                    <button
                      key={pkg.id}
                      type="button"
                      onClick={() => handlePackageSelect(pkg)}
                      className={`relative w-full rounded-xl border-2 p-6 text-left transition-colors ${
                        isPopular
                          ? 'border-brand bg-brand-soft'
                          : 'border-line hover:border-brand/50 hover:bg-canvas'
                      }`}
                    >
                      {isPopular && (
                        <span className="ui-badge ui-badge-promoted absolute -top-3 left-1/2 -translate-x-1/2">
                          {t('payments.packages.popular')}
                        </span>
                      )}

                      <h3 className="text-lg font-bold text-gray-900">{pkg.name}</h3>
                      <div className="mt-2">
                        <span className="text-3xl font-bold text-black">{pkg.credits}</span>
                        <span className="text-gray-600 ml-1">{t('payments.packages.creditsUnit')}</span>
                      </div>

                      <div className="mt-4">
                        {Number(pkg.discount || 0) > 0 ? (
                          <div>
                            <span className="text-gray-400 line-through text-sm">
                              {t('payments.packages.priceBdt', { amount: Number(pkg.price || 0).toLocaleString('en-BD') })}
                            </span>
                            <span className="text-xl font-bold text-gray-900 ml-2">
                              {t('payments.packages.priceBdt', { amount: finalPrice.toLocaleString('en-BD') })}
                            </span>
                            <span className="ml-2 text-gray-700 text-sm font-semibold">
                              {t('payments.packages.discountOff', { discount: pkg.discount })}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xl font-bold text-gray-900">
                            {t('payments.packages.priceBdt', { amount: Number(pkg.price || 0).toLocaleString('en-BD') })}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 text-sm text-gray-500">
                        {t('payments.packages.perCredit', { amount: (finalPrice / Number(pkg.credits || 1)).toFixed(2) })}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <button
              onClick={() => navigate('/dashboard')}
              className="mt-6 text-gray-600 hover:text-gray-800 font-medium"
            >
              {t('payments.packages.backToDashboard')}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <span className="text-gray-900 font-bold">2</span>
              </div>
              <h2 className="text-xl font-bold text-gray-900">{t('payments.checkout.title')}</h2>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 space-y-4 mb-6">
              <div className="flex justify-between">
                <span className="text-gray-600">{t('payments.checkout.packageLabel')}</span>
                <span className="font-semibold">{selectedPackage?.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('payments.checkout.creditsLabel')}</span>
                <span className="font-semibold">{selectedPackage?.credits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">{t('payments.checkout.methodLabel')}</span>
                <span className="font-semibold flex items-center gap-2">
                  {selectedPayment?.icon} {selectedPayment?.name}
                </span>
              </div>
              <div className="border-t pt-4 flex justify-between">
                <span className="text-gray-900 font-semibold">{t('payments.checkout.totalLabel')}</span>
                <span className="text-xl font-bold text-gray-900">
                  {t('payments.packages.priceBdt', { amount: calculateDiscount(selectedPackage).toLocaleString('en-BD') })}
                </span>
              </div>
            </div>

            <img
              src="/payments/eps-checkout-banner.webp"
              alt={t('payments.checkout.payWithEps')}
              className="mb-6 w-full rounded-xl"
              loading="lazy"
              decoding="async"
            />

            <div className="flex gap-4">
              <button
                onClick={() => setStep(1)}
                className="ui-btn ui-btn-secondary flex-1"
              >
                {t('common.back')}
              </button>
              <button
                onClick={handleConfirmPurchase}
                disabled={processingPayment}
                className="ui-btn ui-btn-primary flex-1"
              >
                {processingPayment ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    {t('payments.checkout.processing')}
                  </>
                ) : (
                  t('payments.checkout.payButton', { amount: calculateDiscount(selectedPackage).toLocaleString('en-BD') })
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
