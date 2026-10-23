import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiBookOpen, FiHome, FiMapPin } from 'react-icons/fi';
import { ARTICLE_ITEMS } from './articleContent';
import { useLanguage } from '../../i18n/useLanguage';

const ARTICLE_ICONS = {
    book: FiBookOpen,
    home: FiHome,
    map: FiMapPin,
};

const ArticlePreview = () => {
    const { t } = useLanguage();

    return (
        <section className='py-12 md:py-16'>
            <div className='ui-panel overflow-hidden p-5 sm:p-7 md:p-9'>
                <div className='grid gap-8 lg:grid-cols-[0.9fr_1.4fr] lg:items-center'>
                    <div>
                        <p className='site-kicker'>{t('home.articles.kicker')}</p>
                        <h2 className='mt-3 text-balance text-2xl font-bold leading-tight text-ink md:text-3xl'>
                            {t('home.articles.title')}
                        </h2>
                        <p className='mt-4 max-w-prose text-body text-muted'>
                            {t('home.articles.description')}
                        </p>
                        <Link to='/article' className='ui-btn ui-btn-primary mt-6'>
                            {t('home.articles.readArticles')}
                            <FiArrowRight />
                        </Link>
                    </div>

                    <div className='grid gap-4 sm:grid-cols-3'>
                        {ARTICLE_ITEMS.map((item) => {
                            const Icon = ARTICLE_ICONS[item.icon] || FiBookOpen;

                            return (
                                <article
                                    key={item.title}
                                    className='ui-card p-5'
                                >
                                    <div className='mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft text-brand' aria-hidden='true'>
                                        <Icon className='text-xl' />
                                    </div>
                                    <h3 className='text-base font-semibold leading-6 text-ink'>
                                        {t(`home.articles.items.${item.id}.title`)}
                                    </h3>
                                    <p className='mt-2 text-caption text-muted'>
                                        {t(`home.articles.items.${item.id}.description`)}
                                    </p>
                                </article>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ArticlePreview;
