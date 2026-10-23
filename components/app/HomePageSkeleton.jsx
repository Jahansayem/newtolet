import ListingCardSkeleton from '../../src/components/ListingCardSkeleton.jsx'

// Content-only fallback: it renders inside SiteChrome's <main>, so no header or landmark here.
const HomePageSkeleton = () => (
  <div className="site-shell min-h-screen py-6 md:py-8" aria-hidden="true">
    <div className="mb-6 flex gap-3 overflow-hidden px-1 py-1 md:justify-center">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="h-10 w-28 shrink-0 animate-pulse rounded-full bg-slate-200" />
      ))}
    </div>

    <div className="mb-10 animate-pulse md:mb-12">
      <div className="mx-auto h-9 w-72 max-w-full rounded-md bg-slate-200" />
      <div className="mx-auto mt-3 h-4 w-96 max-w-full rounded-md bg-slate-200" />
      <div className="mx-auto mt-6 h-14 w-full max-w-3xl rounded-2xl bg-slate-200" />
      <div className="mt-8 h-[200px] w-full rounded-2xl bg-slate-200 md:h-[300px] xl:h-[340px]" />
    </div>

    <div className="space-y-12">
      {Array.from({ length: 2 }).map((_, sectionIndex) => (
        <section key={sectionIndex} className="space-y-5">
          <div className="animate-pulse border-b border-line pb-4">
            <div className="h-7 w-36 rounded-md bg-slate-200" />
            <div className="mt-2 h-4 w-48 rounded-md bg-slate-200" />
          </div>
          <div className="grid grid-cols-1 gap-4 gap-y-6 min-[360px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, cardIndex) => (
              <ListingCardSkeleton key={cardIndex} />
            ))}
          </div>
        </section>
      ))}
    </div>
  </div>
)

export default HomePageSkeleton
