'use client'

import { FaBuilding, FaUsers, FaAward, FaHandshake } from 'react-icons/fa'
import { useEffect, useState } from 'react'
import { useLanguage } from '../../i18n/useLanguage'
import { countNewListings } from '../../services/propertyCatalogService'

// Round down to a clean figure: 6,866 -> '6,800+'. Read live so the page never disagrees with search.
const formatListingCount = (count) => {
    if (!Number.isFinite(count) || count <= 0) return null
    const step = count >= 1000 ? 100 : 10
    return `${(Math.floor(count / step) * step).toLocaleString('en-US')}+`
}

const About = ({ headingLevel = 'h2' }) => {
    const Heading = headingLevel
    const { t } = useLanguage()
    const [listedCount, setListedCount] = useState(null)

    useEffect(() => {
        let active = true
        countNewListings({})
            .then((count) => {
                if (active) setListedCount(formatListingCount(count))
            })
            .catch(() => {})
        return () => {
            active = false
        }
    }, [])

    const stats = [
        { icon: <FaBuilding />, value: listedCount || "6,800+", label: t('home.about.stats.propertiesListed') },
        { icon: <FaUsers />, value: "10K+", label: t('home.about.stats.happyCustomers') },
        { icon: <FaAward />, value: "15+", label: t('home.about.stats.yearsExperience') },
        { icon: <FaHandshake />, value: "98%", label: t('home.about.stats.clientSatisfaction') }
    ]

    return (
        <section className="py-12 md:py-20">
            <div className="mx-auto max-w-2xl px-4 text-center">
                <p className="ui-eyebrow">{t('home.about.badge')}</p>
                <Heading className="mt-3 text-2xl font-bold leading-tight text-ink md:text-3xl">
                    {t('home.about.title')}
                </Heading>
                <p className="mx-auto mt-3 max-w-lg text-body text-muted">
                    {t('home.about.description')}
                </p>
            </div>

            <div className="mx-auto mt-10 max-w-5xl">
                <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    {stats.map((stat, index) => (
                        <div key={index} className="ui-card p-5 text-center">
                            <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-soft text-brand" aria-hidden="true">
                                <span className="text-lg">{stat.icon}</span>
                            </div>
                            <dd className="ui-price text-2xl md:text-3xl">{stat.value}</dd>
                            <dt className="mt-1 text-caption text-muted">{stat.label}</dt>
                        </div>
                    ))}
                </dl>
            </div>
        </section>
    )
}

export default About
