import { Link } from 'react-router-dom'
import { BiBuildings, BiHome, BiMessageSquareDetail } from 'react-icons/bi'
import { FiArrowRight, FiClipboard, FiMapPin } from 'react-icons/fi'
import { useLanguage } from '../../i18n/useLanguage'

const steps = [
    {
        icon: <BiBuildings className='text-2xl text-brand' />,
        titleKey: 'orders.landing.steps.browse.title',
        descriptionKey: 'orders.landing.steps.browse.description'
    },
    {
        icon: <FiMapPin className='text-2xl text-brand' />,
        titleKey: 'orders.landing.steps.open.title',
        descriptionKey: 'orders.landing.steps.open.description'
    },
    {
        icon: <BiMessageSquareDetail className='text-2xl text-brand' />,
        titleKey: 'orders.landing.steps.send.title',
        descriptionKey: 'orders.landing.steps.send.description'
    }
]

export default function OrderhomeLanding() {
    const { t } = useLanguage()

    return (
        <div className='min-h-screen bg-gray-50'>
            <section className='border-b border-gray-100 bg-white'>
                <div className='mx-auto grid max-w-6xl gap-10 px-4 py-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20'>
                    <div>
                        <div className='inline-flex items-center gap-2 rounded-full bg-brand/10 px-4 py-2 text-sm font-semibold text-brand'>
                            <BiHome className='text-lg' />
                            <span>{t('orders.landing.badge')}</span>
                        </div>
                        <h1 className='mt-5 max-w-2xl text-4xl font-bold tracking-tight text-gray-900 md:text-5xl'>
                            {t('orders.landing.title')}
                        </h1>
                        <p className='mt-5 max-w-2xl text-lg leading-8 text-gray-600'>
                            {t('orders.landing.description')}
                        </p>

                        <div className='mt-8 flex flex-wrap gap-3'>
                            <Link
                                to='/'
                                className='inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 text-base font-semibold text-white transition-all duration-200 hover:bg-brand-hover'
                            >
                                {t('orders.landing.browseProperties')}
                                <FiArrowRight className='text-lg' />
                            </Link>
                            <Link
                                to='/my-orders'
                                className='inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-6 py-3 text-base font-semibold text-gray-700 transition-colors duration-200 hover:border-brand hover:text-brand'
                            >
                                <FiClipboard className='text-lg' />
                                {t('orders.landing.viewMyOrders')}
                            </Link>
                        </div>
                    </div>

                    <div className='rounded-[32px] bg-gradient-to-br from-[#f5fbff] via-white to-[#eef5ff] p-6 shadow-[0_18px_50px_rgba(30,115,184,0.12)] ring-1 ring-brand/10 lg:p-8'>
                        <div className='rounded-[28px] bg-[#0f2740] p-6 text-white lg:p-8'>
                            <p className='text-sm font-semibold uppercase tracking-[0.2em] text-[#8cc9ff]'>
                                {t('orders.landing.howItWorks')}
                            </p>
                            <div className='mt-6 space-y-5'>
                                {steps.map((step, index) => (
                                    <div key={step.titleKey} className='flex gap-4 rounded-2xl bg-white/8 p-4'>
                                        <div className='flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white'>
                                            {step.icon}
                                        </div>
                                        <div>
                                            <p className='text-sm font-semibold text-[#8cc9ff]'>{t('orders.landing.step', { number: index + 1 })}</p>
                                            <h2 className='mt-1 text-lg font-semibold text-white'>{t(step.titleKey)}</h2>
                                            <p className='mt-1 text-sm leading-6 text-slate-200'>{t(step.descriptionKey)}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className='mx-auto max-w-6xl px-4 py-8 lg:py-14'>
                <div className='rounded-[28px] border border-gray-200 bg-white p-8 shadow-sm lg:p-10'>
                    <div className='grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start'>
                        <div>
                            <p className='text-sm font-semibold uppercase tracking-[0.2em] text-brand'>
                                {t('orders.landing.beforeYouOrder')}
                            </p>
                            <h2 className='mt-3 text-3xl font-bold text-gray-900'>
                                {t('orders.landing.decisionTitle')}
                            </h2>
                            <p className='mt-4 text-base leading-7 text-gray-600'>
                                {t('orders.landing.decisionDescription')}
                            </p>
                        </div>

                        <div className='grid gap-4 md:grid-cols-2'>
                            <div className='rounded-3xl bg-slate-50 p-5'>
                                <p className='text-sm font-semibold text-gray-500'>{t('orders.landing.bestFor')}</p>
                                <p className='mt-3 text-lg font-semibold text-gray-900'>{t('orders.landing.bestForTitle')}</p>
                                <p className='mt-2 text-sm leading-6 text-gray-600'>
                                    {t('orders.landing.bestForDescription')}
                                </p>
                            </div>
                            <div className='rounded-3xl bg-slate-50 p-5'>
                                <p className='text-sm font-semibold text-gray-500'>{t('orders.landing.currentFlow')}</p>
                                <p className='mt-3 text-lg font-semibold text-gray-900'>{t('orders.landing.currentFlowTitle')}</p>
                                <p className='mt-2 text-sm leading-6 text-gray-600'>
                                    {t('orders.landing.currentFlowDescription')}
                                </p>
                            </div>
                            <div className='rounded-3xl bg-slate-50 p-5 md:col-span-2'>
                                <p className='text-sm font-semibold text-gray-500'>{t('orders.landing.nextStep')}</p>
                                <div className='mt-3 flex flex-wrap gap-3'>
                                    <Link
                                        to='/'
                                        className='inline-flex items-center gap-2 rounded-2xl border border-brand/20 bg-brand/5 px-5 py-3 text-sm font-semibold text-brand transition-colors duration-200 hover:bg-brand/10'
                                    >
                                        {t('orders.landing.exploreHomes')}
                                        <FiArrowRight className='text-base' />
                                    </Link>
                                    <Link
                                        to='/propertylist'
                                        className='inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition-colors duration-200 hover:border-brand hover:text-brand'
                                    >
                                        {t('orders.landing.openPropertyList')}
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </div>
    )
}
