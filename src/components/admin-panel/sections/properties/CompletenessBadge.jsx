import React from 'react'
import { getCompletenessFlags, summarizeCompleteness } from '../../../../lib/listingCompleteness'
import Badge from '../../../ui/Badge'

const VARIANT = { ok: 'success', warning: 'warning', critical: 'danger' }

/** "3 issues" / "Complete" badge; the issue names are in the tooltip and read out to assistive tech. */
export default function CompletenessBadge({ listing }) {
  const summary = summarizeCompleteness(getCompletenessFlags(listing))
  return (
    <Badge variant={VARIANT[summary.level]} title={summary.description} className="whitespace-nowrap" data-testid="completeness-badge">
      {summary.text}
      <span className="sr-only">: {summary.description}</span>
    </Badge>
  )
}
