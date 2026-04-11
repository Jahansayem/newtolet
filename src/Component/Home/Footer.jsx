import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { FaFacebookF, FaTwitter, FaInstagram, FaLinkedinIn } from 'react-icons/fa';
import { IoMdMail } from 'react-icons/io';
import { FaPhone, FaLocationDot } from 'react-icons/fa6';
import { IoChevronUp } from 'react-icons/io5';

const LOGO_SRC = '/logo.png'
const LOGO_FALLBACK_SRC = '/logo1.png'

const Footer = () => {
    const [email, setEmail] = useState('');
    const [subscribed, setSubscribed] = useState(false);

    const handleSubscribe = (e) => {
        e.preventDefault();
        if (email && email.includes('@')) {
            setSubscribed(true);
            setEmail('');
            setTimeout(() => setSubscribed(false), 3000);
        }
    };

    const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const currentYear = new Date().getFullYear();

    return (
        <footer className='bg-gray-900 text-white '>
            {/* Main Footer Content */}
            <div className='mx-auto py-16 px-3 md:px-20 lg:px-32'>
                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10'>

                    {/* Brand Section */}
                    <div className='space-y-5 animate-fade-in-up'>
                        <img
                            className='w-40 md:w-44 brightness-0 invert hover:scale-105 transition-transform duration-300'
                            src={LOGO_SRC}
                            alt="Company Logo"
                            onError={(event) => {
                                event.currentTarget.src = LOGO_FALLBACK_SRC
                            }}
                        />
                        <p className='text-gray-400 text-sm leading-relaxed'>
                            Your trusted partner in finding the perfect property. We connect buyers, sellers, and renters with their dream homes through innovative technology and personalized service.
                        </p>
                        <div className='flex gap-3'>
                            <a href="https://facebook.com" target="_blank" rel="noopener noreferrer"
                                className='w-10 h-10 bg-gray-800 hover:bg-[#1E73B8] rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg'>
                                <FaFacebookF className='text-sm' />
                            </a>
                            <a href="https://twitter.com" target="_blank" rel="noopener noreferrer"
                                className='w-10 h-10 bg-gray-800 hover:bg-[#1E73B8] rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg'>
                                <FaTwitter className='text-sm' />
                            </a>
                            <a href="https://instagram.com" target="_blank" rel="noopener noreferrer"
                                className='w-10 h-10 bg-gray-800 hover:bg-[#1E73B8] rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg'>
                                <FaInstagram className='text-sm' />
                            </a>
                            <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer"
                                className='w-10 h-10 bg-gray-800 hover:bg-[#1E73B8] rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg'>
                                <FaLinkedinIn className='text-sm' />
                            </a>
                        </div>
                    </div>

                    {/* Quick Links */}
                    <div className='space-y-5 animate-fade-in-up animation-delay-100'>
                        <h3 className='text-lg font-semibold'>Quick Links</h3>
                        <ul className='space-y-3 text-gray-400 text-sm'>
                            <li>
                                <Link to='/' className='hover:text-[#1E73B8] hover:translate-x-1 inline-block transition-all duration-300'>Home</Link>
                            </li>
                            <li>
                                <Link to='/propertylist' className='hover:text-[#1E73B8] hover:translate-x-1 inline-block transition-all duration-300'>Property List</Link>
                            </li>
                            <li>
                                <Link to='/addproperty' className='hover:text-[#1E73B8] hover:translate-x-1 inline-block transition-all duration-300'>Add Property</Link>
                            </li>
                            <li>
                                <Link to='/about' className='hover:text-[#1E73B8] hover:translate-x-1 inline-block transition-all duration-300'>About Us</Link>
                            </li>
                            <li>
                                <Link to='/contact' className='hover:text-[#1E73B8] hover:translate-x-1 inline-block transition-all duration-300'>Contact</Link>
                            </li>
                        </ul>
                    </div>

                    {/* Property Types */}
                    <div className='space-y-5 animate-fade-in-up animation-delay-200'>
                        <h3 className='text-lg font-semibold'>Property Types</h3>
                        <ul className='space-y-3 text-gray-400 text-sm'>
                            <li>
                                <Link to='/propertylist?type=apartment' className='hover:text-[#1E73B8] hover:translate-x-1 inline-block transition-all duration-300'>Apartments</Link>
                            </li>
                            <li>
                                <Link to='/propertylist?type=house' className='hover:text-[#1E73B8] hover:translate-x-1 inline-block transition-all duration-300'>Houses</Link>
                            </li>
                            <li>
                                <Link to='/propertylist?type=villa' className='hover:text-[#1E73B8] hover:translate-x-1 inline-block transition-all duration-300'>Villas</Link>
                            </li>
                            <li>
                                <Link to='/propertylist?type=commercial' className='hover:text-[#1E73B8] hover:translate-x-1 inline-block transition-all duration-300'>Commercial</Link>
                            </li>
                            <li>
                                <Link to='/propertylist?type=land' className='hover:text-[#1E73B8] hover:translate-x-1 inline-block transition-all duration-300'>Land</Link>
                            </li>
                        </ul>
                    </div>

                    {/* Contact & Newsletter */}
                    <div className='space-y-5 animate-fade-in-up animation-delay-300'>
                        <h3 className='text-lg font-semibold'>Get In Touch</h3>
                        <address className='not-italic space-y-3 text-gray-400 text-sm'>
                            <p className='flex items-center gap-3'>
                                <FaPhone className='text-[#1E73B8]' />
                                <span>+880 1707346634</span>
                            </p>
                            <p className='flex items-center gap-3'>
                                <IoMdMail className='text-[#1E73B8]' />
                                <span>newtolet.com@gmail.com</span>
                            </p>
                            <p className='flex items-start gap-3'>
                                <FaLocationDot className='text-[#1E73B8] mt-1' />
                                <span>jugidor,Moulvibazar,Sylhet</span>
                            </p>
                        </address>

                        {/* Newsletter */}

                    </div>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className='border-t border-gray-800'>
                <div className='mx-auto py-5 px-6 md:px-20 lg:px-32 flex flex-col md:flex-row justify-between items-center gap-4'>
                    <div></div>
                    <div className='text-gray-400 text-sm text-center '>
                        <p>&copy; {currentYear} Property. All rights reserved.</p>
                        <p className='mt-1'>
                            Developed by{' '}
                            <a
                                href='https://www.wavezly.com'
                                target='_blank'
                                rel='noopener noreferrer'
                                className='text-white  hover:text-[#1665a0] font-extrabold transition-colors duration-300'
                            >
                                Wavezly
                            </a>
                        </p>
                    </div>
                     <div className='flex justify-end'>
                    <button
                        onClick={scrollToTop}
                        className='w-10 h-10  bg-[#1E73B8] hover:bg-[#1665a0] rounded-full flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg animate-bounce-in'
                        aria-label="Scroll to top"
                    >
                        <IoChevronUp className='text-xl' />
                    </button>
                </div>
                </div>
               
            </div>
        </footer>
    );
};

export default Footer;
