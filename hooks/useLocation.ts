import { useState, useEffect } from 'react';

interface Location {
    latitude: number;
    longitude: number;
}

const useLocation = () => {
    const [location, setLocation] = useState<Location | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let isMounted = true; // Add this flag to track component mount state

        if (!navigator.geolocation) {
            if (isMounted) {
                setError('Geolocation is not supported by your browser.');
                setIsLoading(false);
            }
            return;
        }

        console.log('Requesting geolocation...');

        const successHandler = (position) => {
            if (isMounted) {
                const coords = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                };
                console.log('Geolocation obtained:', coords);
                setLocation(coords);
                setIsLoading(false);
            }
        };

        const errorHandler = (err) => {
            if (isMounted) {
                console.error('Geolocation error:', err.message);
                setError('Please allow location access for better results.');
                setIsLoading(false);
            }
        };

        navigator.geolocation.getCurrentPosition(successHandler, errorHandler);

        const handleManualLocation = (event: CustomEvent) => {
            if (isMounted && event.detail) {
                console.log('Received manual location:', event.detail);
                setLocation(event.detail);
                setError(null);
                setIsLoading(false);
            }
        };

        // @ts-ignore - TypeScript might complain about CustomEvent
        window.addEventListener('manualLocationObtained', handleManualLocation);

        // Cleanup function to prevent state updates after unmount
        return () => {
            isMounted = false;
        };
    }, []);

    // Add logging when location changes
    useEffect(() => {
        if (location) {
            console.log('Location state updated:', location);
        }
    }, [location]);

    return { location, error, isLoading };
};

export default useLocation;