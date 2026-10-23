import React, { useContext } from 'react';
import { FiBriefcase, FiHome, FiKey, FiShoppingBag, FiUser, FiUsers } from 'react-icons/fi';
import { listcontext } from '../Route/Listprovaider';
import { HOME_CATEGORIES } from './categoryConfig';
import { useLanguage } from '../../i18n/useLanguage';

const CATEGORY_ICONS = {
    Family: FiUsers,
    Bachelor: FiUser,
    Office: FiBriefcase,
    Sublet: FiKey,
    Hostel: FiHome,
    Shop: FiShoppingBag,
};

/**
 * Category chips. `mode="filter"` (default) toggles a filter and announces aria-pressed;
 * `mode="jump"` (homepage) scrolls to a section and announces aria-current instead.
 */
const CategoryFilterBar = ({ selectedCategory: selectedCategoryProp, onCategorySelect, mode = 'filter' }) => {
    const { selectedCategory: selectedCategoryFromContext, setSelectedCategory } = useContext(listcontext);
    const { tv } = useLanguage();
    const selectedCategory = selectedCategoryProp ?? selectedCategoryFromContext;

    const handleCategoryClick = (category) => {
        if (onCategorySelect) {
            onCategorySelect(category);
            return;
        }

        setSelectedCategory(selectedCategory === category ? 'All' : category);
    };

    return (
        <div className='ui-scroll-fade -mx-1 flex w-[calc(100%+0.5rem)] gap-2 overflow-x-auto px-1 py-1 scrollbar-hide lg:mx-0 lg:w-full lg:justify-center lg:overflow-visible lg:[mask-image:none]'>
            {HOME_CATEGORIES.map((label) => {
                const Icon = CATEGORY_ICONS[label];
                const isSelected = selectedCategory === label;
                const stateProps = mode === 'jump'
                    ? { 'aria-current': isSelected ? 'true' : undefined }
                    : { 'aria-pressed': isSelected };

                return (
                    <button
                        key={label}
                        type='button'
                        onClick={() => handleCategoryClick(label)}
                        className='ui-chip shrink-0 md:min-h-11 md:px-5'
                        {...stateProps}
                    >
                        <Icon className='text-base' aria-hidden='true' />
                        <span>{tv('categories', label)}</span>
                    </button>
                );
            })}
        </div>
    );
};

export default CategoryFilterBar;
