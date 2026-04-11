import { Link } from 'react-router-dom'
import { BiBuildings, BiHome, BiMessageSquareDetail } from 'react-icons/bi'
import { FiArrowRight, FiClipboard, FiMapPin } from 'react-icons/fi'

const steps = [
    {
        icon: <BiBuildings className='text-2xl text-[#1E73B8]' />,
        title: 'Browse verified homes',
        description: 'Start from the property list and compare rent, area, and amenities before you place a request.'
    },
    {
        icon: <FiMapPin className='text-2xl text-[#1E73B8]' />,
        title: 'Open the property page',
        description: 'Review the full details, photos, and location so you know exactly which home you want to order.'
    },
    {
        icon: <BiMessageSquareDetail className='text-2xl text-[#1E73B8]' />,
        title: 'Send your request',
        description: 'Use the existing property-specific Order Home flow to contact the owner and move the conversation forward.'
    }
]

export default function OrderhomeLanding() {
    return (
        <div className='min-h-screen bg-gray-50'>
            <section className='border-b border-gray-100 bg-white'>
                <div className='mx-auto grid max-w-6xl gap-10 px-4 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-20'>
                    <div>
                        <div className='inline-flex items-center gap-2 rounded-full bg-[#1E73B8]/10 px-4 py-2 text-sm font-semibold text-[#1E73B8]'>
                            <BiHome className='text-lg' />
                            <span>Order Home Service</span>
                        </div>
                        <h1 className='mt-5 max-w-2xl text-4xl font-bold tracking-tight text-gray-900 md:text-5xl'>
                            Find the right home first, then send your order with less friction.
                        </h1>
                        <p className='mt-5 max-w-2xl text-lg leading-8 text-gray-600'>
                            The Order Home page is your starting point. Browse available listings, open the property you want, and use the existing inquiry flow to contact the owner from that specific home.
                        </p>

                        <div className='mt-8 flex flex-wrap gap-3'>
                            <Link
                                to='/'
                                className='inline-flex items-center gap-2 rounded-2xl bg-[#1E73B8] px-6 py-3 text-base font-semibold text-white transition-all duration-200 hover:bg-[#1665a0]'
                            >
                                Browse Properties
                                <FiArrowRight className='text-lg' />
                            </Link>
                            <Link
                                to='/my-orders'
                                className='inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-6 py-3 text-base font-semibold text-gray-700 transition-colors duration-200 hover:border-[#1E73B8] hover:text-[#1E73B8]'
                            >
                                <FiClipboard className='text-lg' />
                                View My Orders
                            </Link>
                        </div>
                    </div>

                    <div className='rounded-[32px] bg-gradient-to-br from-[#f5fbff] via-white to-[#eef5ff] p-6 shadow-[0_18px_50px_rgba(30,115,184,0.12)] ring-1 ring-[#1E73B8]/10 lg:p-8'>
                        <div className='rounded-[28px] bg-[#0f2740] p-6 text-white lg:p-8'>
                            <p className='text-sm font-semibold uppercase tracking-[0.2em] text-[#8cc9ff]'>
                                How It Works
                            </p>
                            <div className='mt-6 space-y-5'>
                                {steps.map((step, index) => (
                                    <div key={step.title} className='flex gap-4 rounded-2xl bg-white/8 p-4'>
                                        <div className='flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-white'>
                                            {step.icon}
                                        </div>
                                        <div>
                                            <p className='text-sm font-semibold text-[#8cc9ff]'>Step {index + 1}</p>
                                            <h2 className='mt-1 text-lg font-semibold text-white'>{step.title}</h2>
                                            <p className='mt-1 text-sm leading-6 text-slate-200'>{step.description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className='mx-auto max-w-6xl px-4 py-14'>
                <div className='rounded-[28px] border border-gray-200 bg-white p-8 shadow-sm lg:p-10'>
                    <div className='grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-start'>
                        <div>
                            <p className='text-sm font-semibold uppercase tracking-[0.2em] text-[#1E73B8]'>
                                Before You Order
                            </p>
                            <h2 className='mt-3 text-3xl font-bold text-gray-900'>
                                Use the property page as the final decision point.
                            </h2>
                            <p className='mt-4 text-base leading-7 text-gray-600'>
                                This keeps each request tied to the correct listing. Once you pick a home, open its details page and continue from there so your inquiry reaches the right owner with the right property context.
                            </p>
                        </div>

                        <div className='grid gap-4 md:grid-cols-2'>
                            <div className='rounded-3xl bg-slate-50 p-5'>
                                <p className='text-sm font-semibold text-gray-500'>Best for</p>
                                <p className='mt-3 text-lg font-semibold text-gray-900'>Renters comparing multiple homes</p>
                                <p className='mt-2 text-sm leading-6 text-gray-600'>
                                    Start from the listing feed, shortlist options, and then send a focused inquiry from the detail page.
                                </p>
                            </div>
                            <div className='rounded-3xl bg-slate-50 p-5'>
                                <p className='text-sm font-semibold text-gray-500'>Current flow</p>
                                <p className='mt-3 text-lg font-semibold text-gray-900'>Property-specific order requests</p>
                                <p className='mt-2 text-sm leading-6 text-gray-600'>
                                    The dedicated order form already exists for individual properties at the property-level route.
                                </p>
                            </div>
                            <div className='rounded-3xl bg-slate-50 p-5 md:col-span-2'>
                                <p className='text-sm font-semibold text-gray-500'>Recommended next step</p>
                                <div className='mt-3 flex flex-wrap gap-3'>
                                    <Link
                                        to='/'
                                        className='inline-flex items-center gap-2 rounded-2xl border border-[#1E73B8]/20 bg-[#1E73B8]/5 px-5 py-3 text-sm font-semibold text-[#1E73B8] transition-colors duration-200 hover:bg-[#1E73B8]/10'
                                    >
                                        Explore available homes
                                        <FiArrowRight className='text-base' />
                                    </Link>
                                    <Link
                                        to='/propertylist'
                                        className='inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold text-gray-700 transition-colors duration-200 hover:border-[#1E73B8] hover:text-[#1E73B8]'
                                    >
                                        Open property list
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
