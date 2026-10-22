import { COVER_FRAME_CLASSES } from './coverFrame';

const CoverSkeleton = () => (
    <div className='w-full animate-fade-in-up'>
        <div className={`site-card-strong flex items-center justify-center overflow-hidden rounded-[5px] bg-gray-200 ${COVER_FRAME_CLASSES}`}>
            <div className="h-5 w-40 animate-pulse rounded-full bg-gray-300" />
        </div>
    </div>
);

export default CoverSkeleton;
