import { FiBookOpen, FiCheckCircle, FiHome, FiMapPin } from 'react-icons/fi'
import { ARTICLE_ITEMS } from '../../../src/Component/Home/articleContent.js'

const ARTICLE_ICONS = {
  book: FiBookOpen,
  home: FiHome,
  map: FiMapPin,
}

export default function ArticlePage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
        <div className="bg-gradient-to-br from-slate-950 via-[#123B5D] to-[#1E73B8] px-6 py-12 text-white sm:px-10 lg:px-12">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Article</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold leading-tight md:text-5xl">
            Rental guides for smarter home decisions
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/78 md:text-lg">
            Practical tips for tenants and property seekers: choosing the right area, checking a rental home, and avoiding common booking mistakes.
          </p>
        </div>

        <div className="grid gap-5 p-5 sm:p-8 lg:grid-cols-3 lg:p-10">
          {ARTICLE_ITEMS.map((item) => {
            const Icon = ARTICLE_ICONS[item.icon] || FiBookOpen

            return (
              <article key={item.title} className="rounded-3xl border border-slate-100 bg-slate-50 p-6">
                <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${item.accent} text-white shadow-md`}>
                  <Icon className="text-xl" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
              </article>
            )
          })}
        </div>

        <div className="grid gap-5 border-t border-slate-100 p-5 sm:p-8 lg:grid-cols-3 lg:p-10">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <FiHome className="text-2xl text-[#1E73B8]" />
            <h3 className="mt-4 font-bold text-slate-900">Before visiting</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Shortlist by budget, location, room count, and property type before contacting the owner.</p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <FiMapPin className="text-2xl text-[#1E73B8]" />
            <h3 className="mt-4 font-bold text-slate-900">During inspection</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Check water, gas, electricity, security, road access, and nearby daily services.</p>
          </div>
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <FiCheckCircle className="text-2xl text-[#1E73B8]" />
            <h3 className="mt-4 font-bold text-slate-900">Before payment</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Confirm rent, advance, service charge, documents, move-in date, and written agreement terms.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
