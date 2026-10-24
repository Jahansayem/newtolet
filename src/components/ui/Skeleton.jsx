import React from 'react'

const VARIANT_CLASS = {
  line: 'h-4 rounded-md',
  block: 'rounded-[var(--radius-card)]',
  circle: 'rounded-full',
}

/** Loading placeholder. The parent region sets aria-busy; this is decorative. */
export default function Skeleton({ variant = 'line', width, height, className = '', style, ...rest }) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse bg-line/60 ${VARIANT_CLASS[variant] || VARIANT_CLASS.line} ${className}`.trim()}
      style={{ width, height, ...style }}
      {...rest}
    />
  )
}

export function SkeletonRows({ rows = 5, cols = 4, className = '' }) {
  return (
    <div className={`space-y-3 ${className}`.trim()} aria-hidden="true">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, colIndex) => (
            <Skeleton key={colIndex} width={`${60 + ((rowIndex * 7 + colIndex * 13) % 40)}%`} />
          ))}
        </div>
      ))}
    </div>
  )
}
