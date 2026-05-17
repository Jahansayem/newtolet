import React from 'react';
import { Link } from 'react-router-dom';
import { FaFacebookF, FaTwitter, FaInstagram, FaLinkedinIn } from 'react-icons/fa';
import { IoMdMail } from 'react-icons/io';
import { FaPhone, FaLocationDot } from 'react-icons/fa6';
import { IoChevronUp } from 'react-icons/io5';

const LOGO_SRC = '/logo.png';
const LOGO_FALLBACK_SRC = '/logo1.png';

const footerLinks = [
    { to: '/', label: 'Home' },
    { to: '/propertylist2', label: 'Property List' },
    { to: '/addproperty', label: 'Add Property' },
    { to: '/about', label: 'About Us' },
    { to: '/contact', label: 'Contact' },
];

const propertyTypeLinks = [
    { to: '/propertylist?type=apartment', label: 'Apartments' },
    { to: '/propertylist?type=house', label: 'Houses' },
    { to: '/propertylist?type=villa', label: 'Villas' },
    { to: '/propertylist?type=commercial', label: 'Commercial' },
    { to: '/propertylist?type=land', label: 'Land' },
];

const socialLinks = [
    { href: 'https://facebook.com', icon: FaFacebookF, label: 'Facebook' },
    { href: 'https://twitter.com', icon: FaTwitter, label: 'Twitter' },
    { href: 'https://instagram.com', icon: FaInstagram, label: 'Instagram' },
    { href: 'https://linkedin.com', icon: FaLinkedinIn, label: 'LinkedIn' },
];

const Footer = () => {
    const currentYear = new Date().getFullYear();

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <footer className='mt-16 bg-slate-950 text-white'>
            <div className='site-shell-wide py-14 md:py-16'>
                <div className='grid gap-10 border-b border-white/10 pb-12 md:grid-cols-2 xl:grid-cols-[1.15fr_repeat(3,minmax(0,1fr))]'>
                    <div className='space-y-6'>
                        <img
                            className='w-40 brightness-0  invert transition-transform duration-300 hover:scale-[1.02] md:w-44'
                            src={LOGO_SRC}
                            alt="Company Logo"
                            onError={(event) => {
                                event.currentTarget.src = LOGO_FALLBACK_SRC;
                            }}
                        />
                        <p className='max-w-md text-sm leading-7 text-slate-300'>
                            Your trusted partner in finding the right rental property. Search with clearer filters, browse verified listings, and move faster with tools built for real tenants.
                        </p>
                        <div className='flex flex-wrap gap-3'>
                            {socialLinks.map(({ href, icon: Icon, label }) => (
                                <a
                                    key={label}
                                    href={href}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    aria-label={label}
                                    className='flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-slate-200 transition-all duration-300 hover:border-[#1E73B8] hover:bg-[#1E73B8] hover:text-white'
                                >
                                    <Icon className='text-sm' />
                                </a>
                            ))}
                        </div>
                    </div>

                    <div className='space-y-5'>
                        <h3 className='text-base font-semibold text-white'>Quick Links</h3>
                        <ul className='space-y-3 text-sm text-slate-300'>
                            {footerLinks.map(({ to, label }) => (
                                <li key={label}>
                                    <Link to={to} className='inline-flex transition-colors duration-300 hover:text-[#67aee2]'>
                                        {label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className='space-y-5'>
                        <h3 className='text-base font-semibold text-white'>Property Types</h3>
                        <ul className='space-y-3 text-sm text-slate-300'>
                            {propertyTypeLinks.map(({ to, label }) => (
                                <li key={label}>
                                    <Link to={to} className='inline-flex transition-colors duration-300 hover:text-[#67aee2]'>
                                        {label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className='space-y-5'>
                        <h3 className='text-base font-semibold text-white'>Get In Touch</h3>
                        <address className='space-y-4 text-sm not-italic text-slate-300'>
                            <p className='flex items-start gap-3'>
                                <FaPhone className='mt-1 text-[#67aee2]' />
                                <span>09649551551</span>
                            </p>
                            <p className='flex items-start gap-3 break-all'>
                                <IoMdMail className='mt-1 text-[#67aee2]' />
                                <span>newtolet.com@gmail.com</span>
                            </p>
                            <p className='flex items-start gap-3'>
                                <FaLocationDot className='mt-1 text-[#67aee2]' />
                                <span>Jugidor, Moulvibazar, Sylhet</span>
                            </p>
                        </address>
                    </div>
                </div>

                <div className='flex flex-col gap-4 py-6 text-center text-sm text-slate-400 md:flex-row md:items-center md:justify-between md:text-left'>
                    <div>
                        <p>&copy; {currentYear} NewTolet. All rights reserved.</p>
                        <p className='mt-1'>
                            Developed by{' '}
                            <a
                                href='https://www.wavezly.com'
                                target='_blank'
                                rel='noopener noreferrer'
                                className='font-semibold text-white transition-colors duration-300 hover:text-[#67aee2]'
                            >
                                Wavezly
                            </a>
                        </p>
                    </div>

                    <button
                        onClick={scrollToTop}
                        className='ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#1E73B8]/30 bg-[#1E73B8] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#1665a0] hover:shadow-lg md:ml-0'
                        aria-label="Scroll to top"
                    >
                        <IoChevronUp className='text-xl' />
                    </button>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
