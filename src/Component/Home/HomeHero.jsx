'use client'

import React, { useCallback, useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiSearch } from 'react-icons/fi'
import { HOME_CATEGORIES } from './categoryConfig'
import { DEFAULT_SEARCH_FILTERS, buildSearchHref, getLocationOptions } from './propertySearch'
import { useLanguage } from '../../i18n/useLanguage'

const POPULAR_AREAS = ['Mirpur', 'Uttara', 'Dhanmondi', 'Bashundhara']

/**
 * Search-first hero: the page <h1>, one value line and a three-field search that hands off to the
 * results route through buildSearchHref (same URL contract as the search overlay).
 */
const HomeHero = () => {
  const { t, tv } = useLanguage()
  const navigate = useNavigate()
  const keywordId = useId()
  const categoryId = useId()
  const divisionId = useId()
  const [keyword, setKeyword] = useState('')
  const [category, setCategory] = useState('All')
  const [division, setDivision] = useState('')
  const divisions = useMemo(() => getLocationOptions(DEFAULT_SEARCH_FILTERS).divisions, [])

  const submitSearch = useCallback((nextFilters) => {
    navigate(buildSearchHref({ ...DEFAULT_SEARCH_FILTERS, ...nextFilters }))
  }, [navigate])

  const handleSubmit = useCallback((event) => {
    event.preventDefault()
    submitSearch({ search: keyword.trim(), category, division })
  }, [category, division, keyword, submitSearch])

  return (
    <section className='relative overflow-hidden rounded-[var(--radius-panel)] bg-ink px-5 py-8 text-white sm:px-8 sm:py-10 md:px-12 md:py-14'>
      {/* Restrained brand mark: a single soft brand glow in the corner, no gradients across the text. */}
      <div className='pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand/30 blur-3xl' aria-hidden='true' />

      <div className='relative max-w-3xl'>
        <h1 className='text-balance text-[26px] font-bold leading-[1.15] sm:text-3xl md:text-[40px]'>
          {t('home.hero.title')}
        </h1>
        <p className='mt-3 max-w-2xl text-sm leading-6 text-primary-100/85 md:text-base md:leading-7'>
          {t('home.hero.subtitle')}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        role='search'
        aria-label={t('search.overlay.title')}
        className='relative mt-6 grid gap-2 rounded-2xl bg-white p-2 shadow-overlay md:mt-8 md:grid-cols-2 md:items-stretch lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_auto]'
      >
        <div className='relative md:col-span-2 lg:col-span-1'>
          <label htmlFor={keywordId} className='sr-only'>{t('home.hero.keywordLabel')}</label>
          <FiSearch className='pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted' aria-hidden='true' />
          <input
            id={keywordId}
            type='search'
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder={t('home.hero.keywordPlaceholder')}
            className='ui-field border-transparent bg-canvas pl-10 text-ink focus:bg-white'
            autoComplete='off'
          />
        </div>

        <div>
          <label htmlFor={categoryId} className='sr-only'>{t('home.hero.categoryLabel')}</label>
          <select
            id={categoryId}
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className='ui-field border-transparent bg-canvas text-ink focus:bg-white'
          >
            <option value='All'>{t('home.hero.allCategories')}</option>
            {HOME_CATEGORIES.map((item) => (
              <option key={item} value={item}>{tv('categories', item)}</option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={divisionId} className='sr-only'>{t('home.hero.divisionLabel')}</label>
          <select
            id={divisionId}
            value={division}
            onChange={(event) => setDivision(event.target.value)}
            className='ui-field border-transparent bg-canvas text-ink focus:bg-white'
          >
            <option value=''>{t('home.hero.allDivisions')}</option>
            {divisions.map((item) => (
              <option key={item} value={item}>{tv('divisions', item)}</option>
            ))}
          </select>
        </div>

        <button type='submit' className='ui-btn ui-btn-primary md:col-span-2 lg:col-span-1 lg:px-6'>
          <FiSearch className='text-base md:hidden' aria-hidden='true' />
          <span>{t('home.hero.submit')}</span>
        </button>
      </form>

      <div className='relative mt-4 flex flex-wrap items-center gap-x-2 gap-y-1.5 text-sm text-primary-100/80'>
        <span>{t('home.hero.popular')}</span>
        {POPULAR_AREAS.map((area) => (
          <button
            key={area}
            type='button'
            onClick={() => submitSearch({ search: area })}
            className='inline-flex min-h-9 items-center rounded-full border border-white/20 px-3 text-sm font-medium text-white transition-colors hover:border-white/50 hover:bg-white/10 focus-visible:outline-white'
          >
            {area}
          </button>
        ))}
      </div>
    </section>
  )
}

export default HomeHero
