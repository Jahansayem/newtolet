import React from 'react';
import { Link } from 'react-router-dom';
import { buildDashboardHref } from '../../lib/routePaths';

const REFER_EARN_ITEMS = [
    {
        title: 'প্রতি রেফারে আয় করুন ৫০ টাকা',
        description: 'আপনার রেফারকোড ব্যবহার করে কেউ আমাদের সার্ভিস নিলে পাবেন সরাসরি বোনাস।',
    },
    {
        title: 'সহজ ও নিরাপদ',
        description: 'কোনো জটিল হিসাব নেই, সরাসরি ৫০ টাকা বোনাস।',
    },
    {
        title: 'আনলিমিটেড রেফারাল',
        description: 'যত বেশি মানুষকে রেফার করবেন, তত বেশি বোনাস।',
    },
    {
        title: 'সহজ ড্যাশবোর্ড',
        description: 'লাইভে দেখুন কতটি রেফারাল কমপ্লিট হয়েছে, সবকিছু এক নজরে।',
    },
    {
        title: 'টাকা তুলা একদম সহজ',
        description: 'মোবাইল ব্যাংকিং-এর মাধ্যমে সহজেই টাকা তুলতে পারবেন।',
    },
];

const PROPERTY_FINDING_ITEMS = [
    {
        title: 'সহজ কাজ',
        description: 'বাসা খুঁজে দেওয়া বা প্রয়োজনীয় তথ্য যোগ করা।',
    },
    {
        title: 'লোকাল আয়ের সুযোগ',
        description: 'আপনার এলাকার বাসা খুঁজে নিজের ইনকাম।',
    },
    {
        title: 'নিশ্চিত পেমেন্ট',
        description: 'কাজ যাচাই হলে ব্যালান্সে টাকা যোগ।',
    },
    {
        title: 'ফ্লেক্সিবল সময়',
        description: 'যখন সময় খালি, তখন কাজ করতে পারেন।',
    },
    {
        title: 'User Friendly',
        description: 'ওয়েবসাইট বা অ্যাপের মাধ্যমে সহজ সাবমিশন।',
    },
];

const CONTENT_CARDS = [
    {
        title: 'Refer & Earn',
        items: REFER_EARN_ITEMS,
        learnMoreUrl: 'https://www.thetolet.com/bd/article/earn-from-home-refer-and-earn-the-tolet',
        earnNowUrl: buildDashboardHref('referrals'),
    },
    {
        title: 'Property Finding',
        items: PROPERTY_FINDING_ITEMS,
        learnMoreUrl: 'https://www.thetolet.com/bd/article/earn-by-finding-house',
        earnNowUrl: 'https://www.thetolet.com/bd/user-panel/job-feeds',
    },
];

const Earnmoney = () => {
    return (
        <section className='min-h-screen bg-gray-50 py-10 md:py-14'>
            <div className='mx-auto max-w-6xl px-4 sm:px-6 lg:px-8'>
                <nav className='mb-4 flex items-center gap-2 text-sm text-gray-500'>
                    <Link to='/' className='transition hover:text-[#1E73B8]'>
                        Home
                    </Link>
                    <span>/</span>
                    <span className='font-medium text-gray-700'>Earn Money</span>
                </nav>

                <div className='mb-8 border-b border-gray-200 pb-4'>
                    <h1 className='text-3xl font-bold text-gray-900 md:text-4xl'>Earn Money</h1>
                </div>

                <div className='grid gap-6 md:grid-cols-2'>
                    {CONTENT_CARDS.map((card) => (
                        <article
                            key={card.title}
                            className='overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm'
                        >
                            <div className='border-b border-gray-200 bg-gray-50 px-6 py-4'>
                                <h2 className='text-xl font-semibold text-gray-900'>{card.title}</h2>
                            </div>

                            <div className='px-6 py-6'>
                                <ul className='space-y-4'>
                                    {card.items.map((item) => (
                                        <li key={item.title} className='leading-7 text-gray-700'>
                                            <strong className='block text-base font-semibold text-gray-900'>
                                                {item.title}
                                            </strong>
                                            <span className='text-sm sm:text-base'>{item.description}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className='flex flex-wrap items-center justify-center gap-3 border-t border-gray-200 px-6 py-4'>
                                <a
                                    href={card.learnMoreUrl}
                                    target='_blank'
                                    rel='noreferrer'
                                    className='inline-flex items-center justify-center rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 transition hover:border-gray-400 hover:bg-gray-50'
                                >
                                    Learn More
                                </a>
                                {card.earnNowUrl.startsWith('http') ? (
                                    <a
                                        href={card.earnNowUrl}
                                        target='_blank'
                                        rel='noreferrer'
                                        className='inline-flex items-center justify-center rounded-lg bg-[#1E73B8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1665a0]'
                                    >
                                        Earn Now
                                    </a>
                                ) : (
                                    <Link
                                        to={card.earnNowUrl}
                                        className='inline-flex items-center justify-center rounded-lg bg-[#1E73B8] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1665a0]'
                                    >
                                        Earn Now
                                    </Link>
                                )}
                            </div>
                        </article>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default Earnmoney;
