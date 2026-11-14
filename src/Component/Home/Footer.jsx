import React from 'react';
import { Link } from 'react-router-dom';
import { usePathname } from 'next/navigation';
import { IoMdMail } from 'react-icons/io';
import { FaPhone, FaLocationDot } from 'react-icons/fa6';
import { IoChevronUp } from 'react-icons/io5';
import { useLanguage } from '../../i18n/useLanguage';
import { buildSearchHref } from './propertySearch';
import { SITE_CONTACT } from '../../config/siteContact.js';

const LOGO_SRC = '/logo.png';
const LOGO_FALLBACK_SRC = '/logo1.png';

const footerLinks = [
    { to: '/', labelKey: 'footer.links.home' },
    { to: '/propertylist2', labelKey: 'footer.links.propertyList' },
    { to: '/addproperty', labelKey: 'footer.links.addProperty' },
    { to: '/about', labelKey: 'footer.links.aboutUs' },
    { to: '/contact', labelKey: 'footer.links.contact' },
];

const policyLinks = [
    { to: '/terms', labelKey: 'footer.links.terms' },
    { to: '/privacy', labelKey: 'footer.links.privacy' },
    { to: '/refund', labelKey: 'footer.links.refund' },
];

// Only property types the search page can actually filter by (see PROPERTY_TYPE_OPTIONS).
// Labels come from the shared values.propertyTypes dictionary so EN/বাং stay in sync.
const FOOTER_PROPERTY_TYPES = ['Apartment', 'House', 'Room', 'Office', 'Shop'];
const propertyTypeLinks = FOOTER_PROPERTY_TYPES.map((type) => ({
    to: buildSearchHref({ propertyType: type }),
    type,
}));

// Real profile URLs live in SITE_CONTACT.socialLinks ({ href, icon, label }); none are published
// yet, so no icons render instead of linking to the bare facebook.com/twitter.com homepages.
const socialLinks = SITE_CONTACT.socialLinks;

const Footer = () => {
    const { t, tv } = useLanguage();
    const currentYear = new Date().getFullYear();
    // The home page is full width, so its footer drops the shell cap to keep edges aligned.
    const isHomepage = usePathname() === '/';

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <footer className='mt-16 bg-ink text-white'>
            <div className={`site-shell py-12 md:py-16 ${isHomepage ? 'site-shell-full' : ''}`}>
                <div className='grid gap-10 border-b border-white/10 pb-12 md:grid-cols-2 xl:grid-cols-[1.3fr_repeat(3,minmax(0,1fr))]'>
                    <div className='space-y-5'>
                        <img
                            className='w-36 brightness-0 invert md:w-40'
                            src={LOGO_SRC}
                            alt={t('nav.logoAlt')}
                            onError={(event) => {
                                event.currentTarget.src = LOGO_FALLBACK_SRC;
                            }}
                        />
                        <p className='max-w-sm text-sm leading-6 text-primary-100/85'>
                            {t('footer.tagline')}
                        </p>
                        {socialLinks.length > 0 ? (
                        <div className='flex flex-wrap gap-2.5'>
                            {socialLinks.map(({ href, icon: Icon, label }) => (
                                <a
                                    key={label}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={label}
                                    className='flex h-10 w-10 items-center justify-center rounded-full border border-white/15 text-primary-100 transition-colors hover:border-brand hover:bg-brand hover:text-white'
                                >
                                    <Icon className='text-sm' aria-hidden='true' />
                                </a>
                            ))}
                        </div>
                        ) : null}
                    </div>

                    <div className='space-y-4'>
                        <h2 className='ui-eyebrow text-primary-200'>{t('footer.quickLinks')}</h2>
                        <ul className='space-y-1 text-sm'>
                            {footerLinks.map(({ to, labelKey }) => (
                                <li key={labelKey}>
                                    <Link to={to} className='inline-flex min-h-9 items-center text-primary-100/90 transition-colors hover:text-white'>
                                        {t(labelKey)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className='space-y-4'>
                        <h2 className='ui-eyebrow text-primary-200'>{t('footer.propertyTypes')}</h2>
                        <ul className='space-y-1 text-sm'>
                            {propertyTypeLinks.map(({ to, type }) => (
                                <li key={type}>
                                    <Link to={to} className='inline-flex min-h-9 items-center text-primary-100/90 transition-colors hover:text-white'>
                                        {tv('propertyTypes', type)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className='space-y-4'>
                        <h2 className='ui-eyebrow text-primary-200'>{t('footer.getInTouch')}</h2>
                        <address className='space-y-2 text-sm not-italic'>
                            <p className='flex items-center gap-3'>
                                <FaPhone className='text-primary-200' aria-hidden='true' />
                                <a href={SITE_CONTACT.phoneHref} className='inline-flex min-h-9 items-center text-primary-100/90 transition-colors hover:text-white'>{SITE_CONTACT.phoneDisplay}</a>
                            </p>
                            <p className='flex items-center gap-3 break-all'>
                                <IoMdMail className='text-primary-200' aria-hidden='true' />
                                <a href={`mailto:${SITE_CONTACT.email}`} className='inline-flex min-h-9 items-center text-primary-100/90 transition-colors hover:text-white'>{SITE_CONTACT.email}</a>
                            </p>
                            <p className='flex items-start gap-3'>
                                <FaLocationDot className='mt-1 text-primary-200' aria-hidden='true' />
                                <span className='text-primary-100/90'>{t('footer.address')}</span>
                            </p>
                        </address>
                    </div>
                </div>

                {/* EPS merchant badge: the gateway asks merchants to show the accepted-methods strip. */}
                <div className='border-b border-white/10 py-6'>
                    <picture>
                        <source media='(min-width: 768px)' srcSet='/payments/eps-footer-desktop-dark.webp' />
                        <img
                            src='/payments/eps-footer-mobile-dark.webp'
                            alt={t('footer.payWithEps')}
                            className='mx-auto w-full max-w-5xl'
                            loading='lazy'
                            decoding='async'
                        />
                    </picture>
                </div>

                <div className='flex flex-col gap-4 py-6 text-center text-sm text-primary-100/75 md:flex-row md:items-center md:justify-between md:text-left'>
                    <div>
                        <p>{t('footer.copyright', { year: currentYear })}</p>
                        <ul className='mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 md:justify-start'>
                            {policyLinks.map(({ to, labelKey }) => (
                                <li key={labelKey}>
                                    <Link to={to} className='inline-flex min-h-9 items-center underline-offset-4 hover:text-white hover:underline'>
                                        {t(labelKey)}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        <p className='mt-1'>
                            {t('footer.developedBy')}{' '}
                            <a
                                href='https://www.wavezly.com'
                                target='_blank'
                                rel='noopener noreferrer'
                                className='font-semibold text-white transition-colors hover:text-primary-200'
                            >
                                Wavezly
                            </a>
                        </p>
                    </div>

                    <button
                        type='button'
                        onClick={scrollToTop}
                        className='ui-btn ui-btn-icon-lg ml-auto border-white/20 bg-white/10 text-white hover:bg-brand md:ml-0'
                        aria-label={t('footer.scrollToTop')}
                    >
                        <IoChevronUp className='text-xl' aria-hidden='true' />
                    </button>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
