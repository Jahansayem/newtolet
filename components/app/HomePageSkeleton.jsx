const HomePageSkeleton = () => (
  <div className="min-h-screen bg-gray-50">
    <div className="sticky top-0 z-50 border-b border-slate-200 bg-white/95">
      <div className="w-full px-3 md:px-6 xl:px-8">
        <div className="flex items-center justify-between gap-3 py-3">
          <div className="h-10 w-36 animate-pulse rounded-full bg-slate-200 md:w-44" />
          <div className="hidden flex-1 items-center justify-center gap-4 md:flex">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-4 w-20 animate-pulse rounded-full bg-slate-200" />
            ))}
          </div>
          <div className="h-9 w-20 animate-pulse rounded-full bg-slate-200" />
        </div>
      </div>
    </div>

    <main className="site-shell-wide min-h-screen bg-gray-50 py-6 md:py-8">
      <div className="mb-6 flex gap-3 overflow-hidden px-1 py-1 md:justify-center">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-10 w-28 shrink-0 animate-pulse rounded-full bg-slate-200" />
        ))}
      </div>

      <div className="mb-10 md:mb-12">
        <div className="site-card-strong h-[260px] w-full animate-pulse rounded-[5px] bg-slate-200 sm:h-[180px] md:h-[350px] xl:h-[400px]" />
        <div className="mx-auto mt-6 h-4 w-64 max-w-full animate-pulse rounded-full bg-slate-200" />
      </div>

      <div className="space-y-12">
        {Array.from({ length: 2 }).map((_, sectionIndex) => (
          <section key={sectionIndex} className="space-y-5">
            <div className="flex items-center justify-between border-b border-gray-200 pb-4">
              <div className="h-8 w-36 animate-pulse rounded-full bg-slate-200" />
              <div className="h-9 w-28 animate-pulse rounded-full bg-slate-200" />
            </div>
            <div className="grid grid-cols-2 gap-4 gap-y-6 md:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, cardIndex) => (
                <div key={cardIndex} className="h-[320px] animate-pulse rounded-[14px] bg-white shadow-sm md:h-[380px]">
                  <div className="h-40 rounded-t-[14px] bg-slate-200 md:h-52" />
                  <div className="space-y-3 p-3">
                    <div className="h-3 w-16 rounded-full bg-slate-200" />
                    <div className="h-5 w-28 rounded-full bg-slate-200" />
                    <div className="h-4 w-full rounded-full bg-slate-200" />
                    <div className="h-4 w-24 rounded-full bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  </div>
)

export default HomePageSkeleton
