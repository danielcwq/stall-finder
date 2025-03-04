import { useState, useEffect } from 'react';

interface Location {
    latitude: number;
    longitude: number;
}

const useLocation = () => {
    const [location, setLocation] = useState<Location | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser.');
            return;
        }

        console.log('Requesting geolocation...');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                };
                console.log('Geolocation obtained:', coords);
                setLocation(coords);
            },
            (err) => {
                console.error('Geolocation error:', err.message);
                setError('Please allow location access to proceed.');
            }
        );
    }, []);

    // Add logging when location changes
    useEffect(() => {
        if (location) {
            console.log('Location state updated:', location);
        }
    }, [location]);

    return { location, error };
};

export default useLocation;