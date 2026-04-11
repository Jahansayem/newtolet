import React from 'react';
import { useNavigate } from 'react-router-dom';
import List from '../Home/List';
import Homelist from '../Home/Homelist';

const Propertylist = () => {
    const navigate = useNavigate();

    return (
        <div className='bg-gray-50 max-w-[1520px] min-h-screen'>
            <div className='flex flex-col justify-center max-w-[480px] mx-auto my-10 animate-fade-in-up'>
                <div className='text-center space-y-3'>
                    <h2 className='text-3xl md:text-4xl font-bold text-gray-800'>Property List</h2>
                    <p className='text-gray-600'>Simply browse through our extensive list of trusted properties.</p>
                </div>
            </div>

            <div className='mx-auto animate-fade-in-up animation-delay-200'>
                <List></List>
                <Homelist maxItems={20}></Homelist>
            </div>

            <div className='flex justify-center mt-6 mb-10'>
                <button
                    onClick={() => navigate('/')}
                    className='bg-[#1E73B8] hover:bg-[#1665a0] text-white font-semibold py-3 px-8 rounded-full transition-all duration-300 hover:scale-105 hover:shadow-lg'
                >
                    View All Properties
                </button>
            </div>
        </div>
    );
};

export default Propertylist;
