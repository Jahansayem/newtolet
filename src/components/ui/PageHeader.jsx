import React from 'react'

/**
 * Page title block. The shell renders the single <h1>; sections use
 * headingLevel 2 for sub-sections.
 */
export default function PageHeader({ title, description = null, eyebrow = null, actions = null, headingLevel = 1, className = '' }) {
  const Heading = `h${Math.min(Math.max(headingLevel, 1), 6)}`
  return (
    <div className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`.trim()}>
      <div className="min-w-0">
        {eyebrow ? <p className="ui-eyebrow">{eyebrow}</p> : null}
        <Heading className={`text-balance break-words font-bold tracking-tight text-ink ${headingLevel === 1 ? 'text-2xl sm:text-[2rem]' : 'text-xl'}`}>
          {title}
        </Heading>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2 sm:justify-end [&>*]:w-full sm:[&>*]:w-auto">{actions}</div> : null}
    </div>
  )
}
