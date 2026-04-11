import React, { useContext, useEffect, useState } from 'react';
import { listcontext } from '../Route/Listprovaider';

const List = () => {
    const [category, setCategory] = useState([])
    const { selectedCategory, setSelectedCategory } = useContext(listcontext)

    useEffect(() => {
        fetch('/Category.json')
            .then(res => res.json())
            .then(data => setCategory(data))
    }, [])

    const handleCategoryClick = (categoryName) => {
        setSelectedCategory(categoryName)
    }

    return (
        <div className='bg-gray-50'>
            {/* Desktop - wrapped layout */}
            <div className='hidden md:flex flex-wrap justify-center gap-4 mt-5 pb-12'>
                <button
                    onClick={() => handleCategoryClick('All')}
                    className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${selectedCategory === 'All' ? 'bg-[#1E73B8] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-[#1E73B8] hover:text-[#1E73B8]'}`}
                >
                    All
                </button>
                {
                    category.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleCategoryClick(item.category)}
                            className={`px-6 py-2 rounded-full font-medium transition-all duration-300 ${selectedCategory === item.category ? 'bg-[#1E73B8] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-[#1E73B8] hover:text-[#1E73B8]'}`}
                        >
                            {item.category}
                        </button>
                    ))
                }
            </div>

            {/* Mobile - horizontal scroll with touch */}
            <div className='md:hidden flex gap-3 mt-5 pb-12 px-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide touch-pan-x' style={{ scrollBehavior: 'smooth', WebkitOverflowScrolling: 'touch' }}>
                <button
                    onClick={() => handleCategoryClick('All')}
                    className={`px-5 py-2 rounded-full font-medium transition-all duration-300 flex-shrink-0 snap-start ${selectedCategory === 'All' ? 'bg-[#1E73B8] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-[#1E73B8] hover:text-[#1E73B8]'}`}
                >
                    All
                </button>
                {
                    category.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => handleCategoryClick(item.category)}
                            className={`px-5 py-2 rounded-full font-medium transition-all duration-300 flex-shrink-0 snap-start ${selectedCategory === item.category ? 'bg-[#1E73B8] text-white shadow-md' : 'bg-white text-gray-600 border border-gray-200 hover:border-[#1E73B8] hover:text-[#1E73B8]'}`}
                        >
                            {item.category}
                        </button>
                    ))
                }
            </div>
        </div>
    );
};

export default List;
