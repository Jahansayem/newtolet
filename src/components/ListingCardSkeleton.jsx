/**
 * Loading placeholder that mirrors PropertyListingCard: 4:3 media, price line, two-line title,
 * area line, meta row, footer row. Keep the heights in sync with the card so nothing shifts.
 */
const ListingCardSkeleton = () => (
  <div className="ui-card animate-pulse overflow-hidden" aria-hidden="true">
    <div className="aspect-[4/3] bg-slate-200" />
    <div className="space-y-2.5 p-3">
      <div className="h-6 w-28 rounded-md bg-slate-200" />
      <div className="h-11 w-full rounded-md bg-slate-200" />
      <div className="h-4 w-5/6 rounded-md bg-slate-200" />
      <div className="h-4 w-2/3 rounded-md bg-slate-200" />
      <div className="flex items-center justify-between pt-1">
        <div className="h-5 w-20 rounded-md bg-slate-200" />
        <div className="h-9 w-20 rounded-full bg-slate-200" />
      </div>
    </div>
  </div>
)

export default ListingCardSkeleton
