import React, { useContext } from 'react';
import { FiBriefcase, FiHome, FiKey, FiShoppingBag, FiUser, FiUsers } from 'react-icons/fi';
import { listcontext } from '../Route/Listprovaider';
import { HOME_CATEGORIES } from './categoryConfig';

const CATEGORY_ICONS = {
    Family: FiUsers,
    Bachelor: FiUser,
    Office: FiBriefcase,
    Sublet: FiKey,
    Hostel: FiHome,
    Shop: FiShoppingBag,
};

const CategoryFilterBar = ({ selectedCategory: selectedCategoryProp, onCategorySelect }) => {
    const { selectedCategory: selectedCategoryFromContext, setSelectedCategory } = useContext(listcontext);
    const selectedCategory = selectedCategoryProp ?? selectedCategoryFromContext;

    const handleCategoryClick = (category) => {
        if (onCategorySelect) {
            onCategorySelect(category);
            return;
        }

        setSelectedCategory(selectedCategory === category ? 'All' : category);
    };

    return (
        <div className='w-full animate-fade-in-up'>
            <div className='flex w-full gap-3 overflow-x-auto px-1 py-1 scrollbar-hide md:flex-wrap md:justify-center md:overflow-visible'>
                {HOME_CATEGORIES.map((label) => {
                    const Icon = CATEGORY_ICONS[label];
                    const isSelected = selectedCategory === label;

                    return (
                        <button
                            key={label}
                            onClick={() => handleCategoryClick(label)}
                            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-300 md:gap-2 md:px-6 md:py-3 md:text-base ${
                                isSelected
                                    ? 'border-[#1E73B8] bg-[#1E73B8] text-white shadow-md'
                                    : 'border-gray-200 bg-white text-gray-700 shadow-sm hover:border-[#1E73B8] hover:text-[#1E73B8]'
                            }`}
                        >
                            <Icon className='text-base md:text-lg' />
                            <span>{label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default CategoryFilterBar;
