import React from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { FiCheckCircle } from 'react-icons/fi';
import { buildWhatsAppHref } from '../../utils/whatsapp';
import { useLanguage } from '../../i18n/useLanguage';

/** Shown when the owner's account passed ID verification (admin-reviewed NID/passport). */
export const VerifiedOwnerBadge = ({ compact = false, className = '' }) => {
    const { t } = useLanguage();

    return (
        <span
            className={`inline-flex items-center gap-1 rounded-full bg-success-soft font-semibold text-success ${compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'} ${className}`}
            title={t('listing.trust.verifiedOwnerHint')}
        >
            <FiCheckCircle aria-hidden='true' />
            {t('listing.trust.verifiedOwner')}
        </span>
    );
};

/** wa.me button; renders nothing for numbers WhatsApp cannot take. */
export const WhatsAppContactButton = ({ phone, message = '', onClick, className = 'ui-btn ui-btn-secondary w-full' }) => {
    const { t } = useLanguage();
    const href = buildWhatsAppHref(phone, message);

    if (!href) {
        return null;
    }

    return (
        <a href={href} target='_blank' rel='noopener noreferrer' className={className} onClick={onClick}>
            <FaWhatsapp className='text-base text-[#128C7E]' aria-hidden='true' />
            <span>{t('listing.trust.whatsapp')}</span>
        </a>
    );
};
