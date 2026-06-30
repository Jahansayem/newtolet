import React, { createContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
    getAllProperties,
    getAllPropertiesCacheKey,
    getHomepageProperties,
    getHomepagePropertiesCacheKey
} from '../../services/propertyCatalogService';
import { readSnapshot } from '../../services/cacheService';

export const listcontext = createContext('');

const inFlightPropertyRequests = new Map();

const Listprovaider = ({ children, queryOptions, mode = 'all' }) => {
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedPriceRange, setSelectedPriceRange] = useState('All');
    const [list, setList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const hasInitializedRef = useRef(false);
    const lastFetchKeyRef = useRef('');
    const isMountedRef = useRef(false);
    const [refreshVersion, setRefreshVersion] = useState(0);

    // Memoize query options to prevent unnecessary re-fetches
    const normalizedQueryOptions = useMemo(() => ({
        limit: Number.isInteger(queryOptions?.limit) && queryOptions.limit > 0 ? queryOptions.limit : null,
        offset: Number.isInteger(queryOptions?.offset) && queryOptions.offset >= 0 ? queryOptions.offset : 0,
    }), [queryOptions?.limit, queryOptions?.offset]);

    // Create a unique key for the current fetch configuration
    const fetchKey = useMemo(() => {
        return `${mode}-${JSON.stringify(normalizedQueryOptions)}-${refreshVersion}`;
    }, [mode, normalizedQueryOptions, refreshVersion]);

    // Single data loading effect - only runs when fetchKey changes
    useEffect(() => {
        isMountedRef.current = true;

        // Skip if we've already fetched with this exact configuration
        if (hasInitializedRef.current && lastFetchKeyRef.current === fetchKey) {
            return () => {
                isMountedRef.current = false;
            };
        }

        const cacheKey = mode === 'home'
            ? getHomepagePropertiesCacheKey()
            : getAllPropertiesCacheKey(normalizedQueryOptions);
        const cachedProperties = readSnapshot(cacheKey);

        if (Array.isArray(cachedProperties)) {
            setList(cachedProperties);
            setIsLoading(false);
            hasInitializedRef.current = true;
        } else {
            setIsLoading(true);
        }

        const loadProperties = async () => {
            const requestKey = `${mode}-${JSON.stringify(normalizedQueryOptions)}`;

            try {
                if (!inFlightPropertyRequests.has(requestKey)) {
                    inFlightPropertyRequests.set(
                        requestKey,
                        mode === 'home'
                            ? getHomepageProperties()
                            : getAllProperties(normalizedQueryOptions)
                    );
                }

                const properties = await inFlightPropertyRequests.get(requestKey);

                if (isMountedRef.current) {
                    setList(properties || []);
                    hasInitializedRef.current = true;
                    lastFetchKeyRef.current = fetchKey;
                    setIsLoading(false);
                }
            } catch (error) {
                console.error('[Listprovaider] Error fetching properties:', error);
                if (isMountedRef.current) {
                    setList([]);
                    hasInitializedRef.current = true;
                    lastFetchKeyRef.current = fetchKey;
                    setIsLoading(false);
                }
            } finally {
                inFlightPropertyRequests.delete(requestKey);
            }
        };

        loadProperties();

        return () => {
            isMountedRef.current = false;
        };
    }, [fetchKey, mode, normalizedQueryOptions]);

    // Manual refresh function - memoized with useCallback
    const refreshProperties = useCallback(() => {
        hasInitializedRef.current = false; // Reset to trigger a new fetch
        setRefreshVersion((current) => current + 1);
    }, []);

    const listinfo = useMemo(() => ({
        list,
        isLoading,
        selectedCategory,
        setSelectedCategory,
        selectedPriceRange,
        setSelectedPriceRange,
        refreshProperties
    }), [list, isLoading, selectedCategory, selectedPriceRange, refreshProperties]);

    return (
        <listcontext.Provider value={listinfo}>
            {children}
        </listcontext.Provider>
    );
};

export default Listprovaider;
