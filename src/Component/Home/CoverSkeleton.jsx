const CoverSkeleton = () => (
    <div className='w-full animate-fade-in-up'>
        <div className="flex h-[180px] w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-gray-200 md:h-[350px] xl:h-[400px]">
            <div className="h-5 w-40 animate-pulse rounded-full bg-gray-300" />
        </div>
    </div>
);

export default CoverSkeleton;
