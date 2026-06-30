import React from 'react';
import { Link } from 'react-router-dom';
import { FiArrowRight, FiBookOpen, FiHome, FiMapPin } from 'react-icons/fi';
import { ARTICLE_ITEMS } from './articleContent';

const ARTICLE_ICONS = {
    book: FiBookOpen,
    home: FiHome,
    map: FiMapPin,
};

const ArticlePreview = () => {
    return (
        <section className='py-12 md:py-16'>
            <div className='site-card-strong overflow-hidden p-5 sm:p-7 md:p-9'>
                <div className='grid gap-8 lg:grid-cols-[0.9fr_1.4fr] lg:items-center'>
                    <div>
                        <p className='site-kicker'>Rental Articles</p>
                        <h2 className='mt-3 text-balance text-3xl font-bold text-gray-800 md:text-4xl'>
                            Learn before you rent
                        </h2>
                        <p className='mt-4 text-sm leading-7 text-gray-600 md:text-base'>
                            Practical rental tips, area guides, and tenant checklists to help users make faster and safer decisions.
                        </p>
                        <Link to='/article' className='site-button-primary mt-6 inline-flex items-center gap-2 text-sm'>
                            Read Articles
                            <FiArrowRight />
                        </Link>
                    </div>

                    <div className='grid gap-4 sm:grid-cols-3'>
                        {ARTICLE_ITEMS.map((item) => {
                            const Icon = ARTICLE_ICONS[item.icon] || FiBookOpen;

                            return (
                                <article
                                    key={item.title}
                                    className='rounded-3xl border border-gray-100 bg-white p-5 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg'
                                >
                                    <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent} text-white shadow-md`}>
                                        <Icon className='text-xl' />
                                    </div>
                                    <h3 className='text-base font-bold leading-6 text-gray-800'>
                                        {item.title}
                                    </h3>
                                    <p className='mt-3 text-sm leading-6 text-gray-500'>
                                        {item.description}
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
