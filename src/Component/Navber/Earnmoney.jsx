import React from 'react';
import { Link } from 'react-router-dom';
import { buildDashboardHref } from '../../lib/routePaths';
import { useLanguage } from '../../i18n/useLanguage';

const CONTENT_CARDS = [
    {
        key: 'refer',
        learnMoreUrl: 'https://www.thetolet.com/bd/article/earn-from-home-refer-and-earn-the-tolet',
        earnNowUrl: buildDashboardHref('referrals'),
    },
    {
        key: 'finding',
        learnMoreUrl: 'https://www.thetolet.com/bd/article/earn-by-finding-house',
        earnNowUrl: buildDashboardHref('job-feed'),
    },
];

const Earnmoney = () => {
    const { t, dict } = useLanguage();

    return (
        <section className='min-h-screen bg-gray-50 py-10 md:py-14'>
            <div className='mx-auto max-w-6xl px-4 sm:px-6 lg:px-8'>
                <nav className='mb-4 flex items-center gap-2 text-sm text-gray-500'>
                    <Link to='/' className='transition hover:text-brand'>
                        {t('common.home')}
                    </Link>
                    <span>/</span>
                    <span className='font-medium text-gray-700'>{t('earn.breadcrumb')}</span>
                </nav>

                <div className='mb-8 border-b border-gray-200 pb-4'>
                    <h1 className='text-3xl font-bold text-gray-900 md:text-4xl'>{t('earn.title')}</h1>
                </div>

                <div className='grid gap-6 md:grid-cols-2'>
                    {CONTENT_CARDS.map((card) => {
                        const cardContent = dict.earn[card.key];

                        return (
                            <article
                                key={card.key}
                                className='overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm'
                            >
                                <div className='border-b border-gray-200 bg-gray-50 px-6 py-4'>
                                    <h2 className='text-xl font-semibold text-gray-900'>{cardContent.title}</h2>
                                </div>

                                <div className='px-6 py-6'>
                                    <ul className='space-y-4'>
                                        {cardContent.items.map((item) => (
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
                                        {t('earn.learnMore')}
                                    </a>
                                    {card.earnNowUrl.startsWith('http') ? (
                                        <a
                                            href={card.earnNowUrl}
                                            target='_blank'
                                            rel='noreferrer'
                                            className='inline-flex items-center justify-center rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover'
                                        >
                                            {t('earn.earnNow')}
                                        </a>
                                    ) : (
                                        <Link
                                            to={card.earnNowUrl}
                                            className='inline-flex items-center justify-center rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-hover'
                                        >
                                            {t('earn.earnNow')}
                                        </Link>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};

export default Earnmoney;
