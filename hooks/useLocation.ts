// hooks/useLocation.ts
import { useState, useEffect } from 'react';

interface Location {
    latitude: number;
    longitude: number;
}

const useLocation = () => {
    const [location, setLocation] = useState<Location | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    // New state to track if we need to show a prompt for Safari
    const [needsSafariPrompt, setNeedsSafariPrompt] = useState(false);

    // Detect Safari on iOS
    const isIOSSafari = () => {
        const ua = navigator.userAgent;
        return /iPad|iPhone|iPod/.test(ua) && !window.MSStream && /Safari/.test(ua) && !/Chrome/.test(ua);
    };

    const requestLocation = () => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser.');
            setIsLoading(false);
            return;
        }

        console.log('Requesting geolocation...');

        const successHandler = (position) => {
            const coords = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
            };
            console.log('Geolocation obtained:', coords);
            setLocation(coords);
            setError(null);
            setIsLoading(false);
            setNeedsSafariPrompt(false);
        };

        const errorHandler = (err) => {
            console.error('Geolocation error:', err);

            // Check specifically for iOS Safari permissions issues
            if (isIOSSafari() && (err.code === 1 || err.code === err.PERMISSION_DENIED)) {
                setNeedsSafariPrompt(true);
                setError('Safari requires explicit permission for location access.');
            } else {
                setError('Please allow location access for better results.');
            }

            setIsLoading(false);
        };

        navigator.geolocation.getCurrentPosition(
            successHandler,
            errorHandler,
            {
                enableHighAccuracy: true,
                timeout: 15000,  // Longer timeout for iOS
                maximumAge: 0
            }
        );
    };

    // Listen for a custom event for manual location requests
    useEffect(() => {
        const handleManualLocation = (event: any) => {
            if (event.detail) {
                console.log('Manual location received:', event.detail);
                setLocation(event.detail);
                setError(null);
                setIsLoading(false);
                setNeedsSafariPrompt(false);
            }
        };

        window.addEventListener('manualLocationObtained', handleManualLocation);

        // Initial request
        requestLocation();

        return () => {
            window.removeEventListener('manualLocationObtained', handleManualLocation);
        };
    }, []);

    return {
        location,
        error,
        isLoading,
        needsSafariPrompt,
        requestLocation  // Expose this so it can be called manually
    };
};

export default useLocation;