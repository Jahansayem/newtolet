import React, { useState, useCallback, memo } from 'react';
import locationData from '../../thetolet_locations_bundle.json';

const Places = ({ onLocationSelect }) => {
    // Transform hierarchical data to flat structures for compatibility
    const divisions = locationData.divisions.map(d => d.name);
    const districts = {};
    const areas = {};
    const subAreas = {};

    locationData.divisions.forEach(division => {
        districts[division.name] = division.districts.map(d => d.name);
        division.districts.forEach(district => {
            areas[district.name] = district.upazillas.map(u => u.name);
            district.upazillas.forEach(upazilla => {
                if (upazilla.sub_areas && upazilla.sub_areas.length > 0) {
                    subAreas[upazilla.name] = upazilla.sub_areas;
                }
            });
        });
    });
    const [level, setLevel] = useState(1); // 1 = division, 2 = district, 3 = upazilla, 4 = sub-area, 5 = specific area
    const [selectedDivision, setSelectedDivision] = useState(null);
    const [selectedDistrict, setSelectedDistrict] = useState(null);
    const [selectedUpazilla, setSelectedUpazilla] = useState(null);
    const [selectedSubArea, setSelectedSubArea] = useState(null);
    const [selectedArea, setSelectedArea] = useState(null);

    // Handle division click
    const handleDivisionClick = useCallback((division) => {
        setSelectedDivision(division);
        setLevel(2);
        setSelectedDistrict(null);
        setSelectedUpazilla(null);
        setSelectedSubArea(null);
        setSelectedArea(null);
        // Trigger filter at division level
        if (onLocationSelect) {
            onLocationSelect({
                division: division,
                district: null,
                upazilla: null,
                subArea: null,
                area: null
            });
        }
    }, [onLocationSelect]);

    // Handle district click
    const handleDistrictClick = useCallback((district) => {
        setSelectedDistrict(district);
        setLevel(3);
        setSelectedUpazilla(null);
        setSelectedSubArea(null);
        setSelectedArea(null);
        // Trigger filter at district level
        if (onLocationSelect) {
            onLocationSelect({
                division: selectedDivision,
                district: district,
                upazilla: null,
                subArea: null,
                area: null
            });
        }
    }, [onLocationSelect, selectedDivision]);

    // Handle upazilla click
    const handleUpazillaClick = useCallback((upazilla) => {
        setSelectedUpazilla(upazilla);
        // Check if this upazilla has sub-areas
        const upazillaSubAreas = subAreas[upazilla] || [];
        if (upazillaSubAreas.length > 0) {
            setLevel(4);
        }
        setSelectedSubArea(null);
        setSelectedArea(null);
        // Trigger filter at upazilla level
        if (onLocationSelect) {
            onLocationSelect({
                division: selectedDivision,
                district: selectedDistrict,
                upazilla: upazilla,
                subArea: null,
                area: null
            });
        }
    }, [onLocationSelect, selectedDivision, selectedDistrict]);

    // Handle sub-area click
    const handleSubAreaClick = useCallback((subArea) => {
        setSelectedSubArea(subArea);
        // Check if this subarea has specific areas
        const subAreaSpecifics = subAreas[subArea] || [];
        if (subAreaSpecifics.length > 0) {
            setLevel(5);
        }
        setSelectedArea(null);
        // Trigger filter at sub-area level
        if (onLocationSelect) {
            onLocationSelect({
                division: selectedDivision,
                district: selectedDistrict,
                upazilla: selectedUpazilla,
                subArea: subArea,
                area: null
            });
        }
    }, [onLocationSelect, selectedDivision, selectedDistrict, selectedUpazilla]);

    // Handle specific area click (Level 5)
    const handleAreaClick = useCallback((area) => {
        setSelectedArea(area);
        // Trigger filter at specific area level
        if (onLocationSelect) {
            onLocationSelect({
                division: selectedDivision,
                district: selectedDistrict,
                upazilla: selectedUpazilla,
                subArea: selectedSubArea,
                area: area
            });
        }
    }, [onLocationSelect, selectedDivision, selectedDistrict, selectedUpazilla, selectedSubArea]);

    // Reset to division level
    const handleReset = useCallback(() => {
        setLevel(1);
        setSelectedDivision(null);
        setSelectedDistrict(null);
        setSelectedUpazilla(null);
        setSelectedSubArea(null);
        setSelectedArea(null);
        if (onLocationSelect) {
            onLocationSelect(null);
        }
    }, [onLocationSelect]);

    // Go back to previous level
    const handleBack = useCallback(() => {
        if (level === 5) {
            setLevel(4);
            setSelectedArea(null);
        } else if (level === 4) {
            setLevel(3);
            setSelectedSubArea(null);
            setSelectedArea(null);
        } else if (level === 3) {
            setLevel(2);
            setSelectedUpazilla(null);
            setSelectedSubArea(null);
            setSelectedArea(null);
        } else if (level === 2) {
            setLevel(1);
            setSelectedDivision(null);
            setSelectedDistrict(null);
            setSelectedUpazilla(null);
            setSelectedSubArea(null);
            setSelectedArea(null);
        }
    }, [level]);

    // Get current level items
    const getCurrentItems = () => {
        if (level === 1) return divisions;
        if (level === 2 && selectedDivision) return districts[selectedDivision] || [];
        if (level === 3 && selectedDistrict) return areas[selectedDistrict] || [];
        if (level === 4 && selectedUpazilla) return subAreas[selectedUpazilla] || [];
        if (level === 5 && selectedSubArea) return subAreas[selectedSubArea] || [];
        return [];
    };

    // Get current level label
    const getLevelLabel = () => {
        if (level === 1) return 'Division';
        if (level === 2) return `District - ${selectedDivision}`;
        if (level === 3) return `Upazilla - ${selectedDistrict}`;
        if (level === 4) return `Sub Area - ${selectedUpazilla}`;
        if (level === 5) return `Area - ${selectedSubArea}`;
        return '';
    };

    const currentItems = getCurrentItems();

    return (
        <div className='bg-gray-50'>
            {/* Header with navigation */}
            <div className='flex items-center gap-2 mb-4 px-4 md:px-0 flex-wrap'>
                <button
                    onClick={handleReset}
                    className='text-sm text-[#1E73B8] hover:text-[#1665a0] font-medium'
                >
                    All Locations
                </button>
                {selectedDivision && (
                    <>
                        <span className='text-gray-400'>/</span>
                        <button
                            onClick={() => setLevel(1)}
                            className={`text-sm font-medium ${level === 1 ? 'text-[#1E73B8]' : 'text-gray-600 hover:text-[#1E73B8]'}`}
                        >
                            {selectedDivision}
                        </button>
                    </>
                )}
                {selectedDistrict && (
                    <>
                        <span className='text-gray-400'>/</span>
                        <button
                            onClick={() => setLevel(2)}
                            className={`text-sm font-medium ${level === 2 ? 'text-[#1E73B8]' : 'text-gray-600 hover:text-[#1E73B8]'}`}
                        >
                            {selectedDistrict}
                        </button>
                    </>
                )}
                {selectedUpazilla && (
                    <>
                        <span className='text-gray-400'>/</span>
                        <button
                            onClick={() => setLevel(3)}
                            className={`text-sm font-medium ${level === 3 ? 'text-[#1E73B8]' : 'text-gray-600 hover:text-[#1E73B8]'}`}
                        >
                            {selectedUpazilla}
                        </button>
                    </>
                )}
                {selectedSubArea && (
                    <>
                        <span className='text-gray-400'>/</span>
                        <span className='text-sm font-medium text-gray-600'>
                            {selectedSubArea}
                        </span>
                    </>
                )}
            </div>

            {/* Level Label */}
            <div className='mb-3 px-4 md:px-0'>
                <h3 className='text-sm md:text-base font-semibold text-gray-700'>{getLevelLabel()}</h3>
            </div>

            {/* Desktop - wrapped layout */}
            <div className='hidden md:flex flex-wrap justify-center gap-3 pb-8'>
                {currentItems.map((item, index) => {
                    const isSelected = level === 1 ? selectedDivision === item :
                                       level === 2 ? selectedDistrict === item :
                                       level === 3 ? selectedUpazilla === item :
                                       level === 4 ? selectedSubArea === item :
                                       selectedArea === item;
                    return (
                        <button
                            key={index}
                            onClick={() => {
                                if (level === 1) handleDivisionClick(item);
                                else if (level === 2) handleDistrictClick(item);
                                else if (level === 3) handleUpazillaClick(item);
                                else if (level === 4) handleSubAreaClick(item);
                                else handleAreaClick(item);
                            }}
                            className={`px-5 py-2 rounded-full font-medium transition-all duration-300 ${
                                isSelected
                                    ? 'bg-[#1E73B8] text-white shadow-md'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:border-[#1E73B8] hover:text-[#1E73B8]'
                            }`}
                        >
                            {item}
                        </button>
                    );
                })}
            </div>

            {/* Mobile - horizontal scroll with touch */}
            <div className='md:hidden flex gap-3 pb-8 px-4 overflow-x-auto scrollbar-hide'>
                {currentItems.map((item, index) => {
                    const isSelected = level === 1 ? selectedDivision === item :
                                       level === 2 ? selectedDistrict === item :
                                       level === 3 ? selectedUpazilla === item :
                                       level === 4 ? selectedSubArea === item :
                                       selectedArea === item;
                    return (
                        <button
                            key={index}
                            onClick={() => {
                                if (level === 1) handleDivisionClick(item);
                                else if (level === 2) handleDistrictClick(item);
                                else if (level === 3) handleUpazillaClick(item);
                                else if (level === 4) handleSubAreaClick(item);
                                else handleAreaClick(item);
                            }}
                            className={`px-5 py-2 rounded-full font-medium transition-all duration-300 flex-shrink-0 whitespace-nowrap ${
                                isSelected
                                    ? 'bg-[#1E73B8] text-white shadow-md'
                                    : 'bg-white text-gray-600 border border-gray-200 hover:border-[#1E73B8] hover:text-[#1E73B8]'
                            }`}
                        >
                            {item}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};

export default memo(Places);
