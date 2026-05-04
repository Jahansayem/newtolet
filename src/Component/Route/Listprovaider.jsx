import React, { createContext, useEffect, useMemo, useState } from 'react';
import useHydratedSnapshot from '../../hooks/useHydratedSnapshot';
import {
    getAllProperties,
    getAllPropertiesCacheKey,
    getHomepageProperties,
    getHomepagePropertiesCacheKey,
} from '../../services/propertyCatalogService';
export const listcontext = createContext('')
const Listprovaider = ({children, queryOptions, mode = 'all'}) => {
     const [selectedCategory, setSelectedCategory] = useState('All')
     const [selectedPriceRange, setSelectedPriceRange] = useState('All')
     const [refreshKey, setRefreshKey] = useState(0)
     const normalizedQueryOptions = useMemo(() => ({
         limit: Number.isInteger(queryOptions?.limit) && queryOptions.limit > 0 ? queryOptions.limit : null,
         offset: Number.isInteger(queryOptions?.offset) && queryOptions.offset >= 0 ? queryOptions.offset : 0,
     }), [queryOptions?.limit, queryOptions?.offset])
     const propertiesCacheKey = useMemo(() => (
         mode === 'home'
             ? getHomepagePropertiesCacheKey()
             : getAllPropertiesCacheKey(normalizedQueryOptions)
     ), [mode, normalizedQueryOptions])
     const {
         snapshot: cachedProperties,
         hasSnapshot: hasCachedProperties,
         isHydrated
     } = useHydratedSnapshot(propertiesCacheKey)
     const [list,setList] = useState([])
      const [isLoading, setIsLoading] = useState(true)

     // Function to manually refresh property list
     const refreshProperties = () => {
         setRefreshKey(prev => prev + 1)
     }

    useEffect(() => {
            if (!isHydrated) {
                return
            }

            if (hasCachedProperties) {
                setList(Array.isArray(cachedProperties) ? cachedProperties : [])
                setIsLoading(false)
            }
        },[cachedProperties, hasCachedProperties, isHydrated])

    useEffect(()=>{
            if (!isHydrated) {
                return
            }

            const fetchProperties = async () => {
                if (!hasCachedProperties) {
                    setIsLoading(true)
                }

                try {
                    const properties = mode === 'home'
                        ? await getHomepageProperties()
                        : await getAllProperties(normalizedQueryOptions)
                    setList(properties)
                } catch (error) {
                    console.error('Error fetching properties:', error)
                    if (!hasCachedProperties) {
                        setList([])
                    }
                } finally {
                    setIsLoading(false)
                }
            }
            fetchProperties()
        },[hasCachedProperties, isHydrated, mode, normalizedQueryOptions, refreshKey])

        const listinfo = useMemo(() => ({
            list,
            isLoading,
            selectedCategory,
            setSelectedCategory,
            selectedPriceRange,
            setSelectedPriceRange,
            refreshProperties
        }), [list, isLoading, selectedCategory, selectedPriceRange])
    return (
        <listcontext.Provider value={listinfo}>
            {children}
        </listcontext.Provider>
    );
};

export default Listprovaider;
