import { useState, useEffect, Fragment } from 'react';
import { trackSearch, trackResultClick } from '../utils/analytics';
import useLocation from '../hooks/useLocation';
import SearchTabs from '../components/SearchTabs';
import FreeSearch from '../components/FreeSearch';
import dynamic from 'next/dynamic'

const LocationPicker = dynamic(
    () => import('../components/LocationPicker'),
    { ssr: false }
);
export default function Home() {
    const { location, error: locError, isLoading } = useLocation();
    const [showMapPicker, setShowMapPicker] = useState(false);
    const [cuisine, setCuisine] = useState('');
    const [proximity, setProximity] = useState('');
    const [proximityValue, setProximityValue] = useState(5); // Default to 5km
    const [affordability, setAffordability] = useState('');
    const [affordabilityValue, setAffordabilityValue] = useState(2); // Default to 2 ($$)
    const [comments, setComments] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [standardResults, setStandardResults] = useState<any[]>([]);
    const [rerankedResults, setRerankedResults] = useState<any[]>([]);
    const [compareMode, setCompareMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'guided' | 'free'>('guided');
    const [showExplanation, setShowExplanation] = useState(false);
    const cuisines = ['Chinese', 'Western', 'Indian', 'Japanese', 'Malay', 'Korean', 'Peranakan', 'Others'];
    const proximities = ['1 km', '5 km', '10 km', '25 km'];
    const affordabilities = ['$', '$$', '$$$'];
    const [requestingLocation, setRequestingLocation] = useState(false);
    const handleMapLocationSelect = (coords) => {
        // Create a custom event to notify the useLocation hook
        const locationEvent = new CustomEvent('manualLocationObtained', {
            detail: coords
        });
        window.dispatchEvent(locationEvent);

        // Hide the map picker after selection
        setShowMapPicker(false);
    };
    const requestLocationManually = () => {
        setRequestingLocation(true);

        if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser.');
            setRequestingLocation(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                // Success handler
                const coords = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                };
                console.log('Manual location success:', coords);

                // Create a custom event to notify the useLocation hook
                const locationEvent = new CustomEvent('manualLocationObtained', {
                    detail: coords
                });
                window.dispatchEvent(locationEvent);

                setRequestingLocation(false);
            },
            (error) => {
                // Error handler - test
                console.error('Manual location error:', error.message);
                let errorMsg = 'Could not get your location.';

                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMsg = 'Location permission was denied. Please check your browser settings.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMsg = 'Location information is unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMsg = 'Location request timed out.';
                        break;
                }

                setError(errorMsg);
                setRequestingLocation(false);
            },
            {
                enableHighAccuracy: true,  // Get the most accurate position
                timeout: 10000,           // Time limit for obtaining location
                maximumAge: 0             // Don't use cached position
            }
        );
    };

    useEffect(() => {
        // Debug location state
        console.log('Current location state:', {
            locationExists: !!location,
            locationValues: location,
            locError,
            isLoading
        });

        // Check if the browser supports geolocation
        if (!navigator.geolocation) {
            console.error('Geolocation is not supported by this browser');
            return;
        }

        // Test geolocation permissions
        navigator.permissions.query({ name: 'geolocation' }).then(permissionStatus => {
            console.log('Geolocation permission status:', permissionStatus.state);

            permissionStatus.onchange = () => {
                console.log('Geolocation permission changed to:', permissionStatus.state);
            };
        });
    }, [location, locError, isLoading]);

    useEffect(() => {
        // Just set the proximity directly as a string with km unit
        setProximity(`${proximityValue.toFixed(1)} km`);
    }, [proximityValue]);

    // Map affordability value (1-4) to price categories
    useEffect(() => {
        const index = Math.min(Math.max(Math.floor(affordabilityValue), 0), 2);
        setAffordability(affordabilities[index]);
    }, [affordabilityValue, affordabilities]);

    const logSearch = async (searchData) => {
        try {
            await fetch('/api/log-search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(searchData),
            });
        } catch (err) {
            console.error('Failed to log search:', err);
            // Don't throw - we don't want logging failures to affect the user experience
        }
    };

    const handleFreeSearch = async (query: string, compare: boolean = false) => {
        setLoading(true);
        setError(null);
        setResults([]);
        setStandardResults([]);
        setRerankedResults([]);
        setCompareMode(compare);

        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    mode: 'free',
                    compare,
                    latitude: location ? location.latitude : null,
                    longitude: location ? location.longitude : null,
                }),
            });

            if (!response.ok) throw new Error('Search failed');
            const data = await response.json();

            if (compare && data.standard && data.reranked) {
                // Compare mode: set both result sets
                setStandardResults(data.standard);
                setRerankedResults(data.reranked);
                // Track the search event
                trackSearch(query, 'free-compare', data.standard.length);
            } else {
                // Normal mode: set single result set
                setResults(data);
                trackSearch(query, 'free', data.length);
            }

            // Log the search to Supabase
            logSearch({
                search_mode: compare ? 'free-compare' : 'free',
                query,
                cuisine: null,
                proximity: null,
                affordability: null,
                comments: null,
                latitude: location ? location.latitude : null,
                longitude: location ? location.longitude : null,
                results_count: compare ? data.standard?.length : data.length
            });
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };


    const [guidedCompareMode, setGuidedCompareMode] = useState(false);

    const handleGuidedSearch = async () => {
        if (!location) {
            setError('Location is required for search. Please allow location access.');
            return;
        }

        setLoading(true);
        setError(null);
        setResults([]);
        setStandardResults([]);
        setRerankedResults([]);
        setCompareMode(guidedCompareMode);

        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'guided',
                    compare: guidedCompareMode,
                    latitude: location.latitude,
                    longitude: location.longitude,
                    cuisine,
                    proximity,
                    affordability,
                    comments,
                }),
            });

            if (!response.ok) throw new Error('Search failed');
            const data = await response.json();

            if (guidedCompareMode && data.standard && data.reranked) {
                // Compare mode: set both result sets
                setStandardResults(data.standard);
                setRerankedResults(data.reranked);
                // Track the search event
                trackSearch(
                    `Cuisine: ${cuisine}, Proximity: ${proximity}, Affordability: ${affordability}, Comments: ${comments}`,
                    'guided-compare',
                    data.standard.length
                );
            } else {
                // Normal mode: set single result set
                setResults(data);
                trackSearch(
                    `Cuisine: ${cuisine}, Proximity: ${proximity}, Affordability: ${affordability}, Comments: ${comments}`,
                    'guided',
                    data.length
                );
            }

            // Log the search to Supabase
            logSearch({
                search_mode: guidedCompareMode ? 'guided-compare' : 'guided',
                query: null,
                cuisine,
                proximity,
                affordability,
                comments,
                latitude: location.latitude,
                longitude: location.longitude,
                results_count: guidedCompareMode ? data.standard?.length : data.length
            });
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex flex-col items-center min-h-screen p-4 bg-gray-100">
            {/* Static Header with Explanation */}
            <div className="mb-6 text-center">
                <h1 className="text-2xl font-bold mb-1">Ho Jiak Bo?</h1>
                <button
                    onClick={() => setShowExplanation(!showExplanation)}
                    className="text-sm text-blue-600 hover:underline mb-2 flex items-center justify-center mx-auto"
                >
                    <span>What does this mean?</span>
                    <span className="ml-1 transform transition-transform">
                        {showExplanation ? "↓" : "→"}
                    </span>
                </button>

                {showExplanation && (
                    <div className="bg-white p-3 rounded-md shadow-sm text-sm text-gray-700 mb-3 max-w-md text-justify">
                        <p>"Hojiak Bo?" is Hokkien for "Is it delicious?"</p>
                        <p>This app helps you find great food stalls from popular food blogs near you!</p>
                    </div>
                )}

                <div className="text-xs text-gray-500">
                    Made with ❤️ by <a href="https://danielcwq.com" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Daniel Ching</a>
                </div>
            </div>

            {locError && (
                <div className="w-full max-w-md mb-4">
                    <div className="p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded mb-2">
                        {locError} Search results may be limited without location access.
                    </div>

                    {/* Replace the button with options */}
                    <div className="flex flex-col space-y-2">
                        <button
                            onClick={() => setShowMapPicker(true)}
                            className="w-full bg-blue-600 text-white p-3 rounded-md hover:bg-blue-700 transition flex items-center justify-center"
                        >
                            <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"></path>
                            </svg>
                            Choose Location on Map
                        </button>

                        <button
                            onClick={requestLocationManually}
                            disabled={requestingLocation}
                            className="w-full bg-gray-600 text-white p-3 rounded-md hover:bg-gray-700 transition flex items-center justify-center"
                        >
                            {requestingLocation ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Requesting Location...
                                </>
                            ) : (
                                <>
                                    <svg className="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path>
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path>
                                    </svg>
                                    Try Browser Location Again
                                </>
                            )}
                        </button>
                    </div>

                    <div className="mt-2 text-xs text-gray-500 text-center">
                        If these options fail, use "I'm Feeling Lucky!"
                    </div>
                </div>
            )}

            {/* Add the map picker modal */}
            {showMapPicker && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl overflow-hidden">
                        <div className="p-4 border-b flex justify-between items-center">
                            <h3 className="text-lg font-medium">Select Your Location</h3>
                            <button
                                onClick={() => setShowMapPicker(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="h-96">
                            <LocationPicker onLocationSelect={handleMapLocationSelect} />
                        </div>
                        <div className="p-4 border-t bg-gray-50 text-sm text-gray-500">
                            Click on the map to select your location, then click "Confirm"
                        </div>
                    </div>
                </div>
            )}

            <SearchTabs activeTab={activeTab} onTabChange={setActiveTab} />

            {activeTab === 'guided' ? (
                <form className="w-full max-w-md space-y-6">
                    <div>
                        <label htmlFor="cuisine" className="block text-sm font-medium text-gray-700 mb-1">
                            Cuisine
                        </label>
                        <select
                            id="cuisine"
                            value={cuisine}
                            onChange={(e) => setCuisine(e.target.value)}
                            className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">Select Cuisine</option>
                            {cuisines.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div>
                        <label htmlFor="proximity" className="block text-sm font-medium text-gray-700 mb-1">
                            Proximity: {proximityValue.toFixed(1)} km
                        </label>
                        <input
                            id="proximity"
                            type="range"
                            min="1"
                            max="25"
                            step="0.5"
                            value={proximityValue}
                            onChange={(e) => setProximityValue(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="w-full h-6 relative mt-1">
                            <span className="absolute text-xs text-gray-500" style={{ left: '0%' }}>1 km</span>
                            <span className="absolute text-xs text-gray-500" style={{ left: 'calc((5 - 1) / (25 - 1) * 100%)' }}>5 km</span>
                            <span className="absolute text-xs text-gray-500" style={{ left: 'calc((10 - 1) / (25 - 1) * 100%)' }}>10 km</span>
                            <span className="absolute text-xs text-gray-500" style={{ right: '0' }}>25 km</span>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="affordability" className="block text-sm font-medium text-gray-700 mb-1">
                            Price Range
                        </label>
                        <input
                            id="affordability"
                            type="range"
                            min="1"
                            max="3"
                            step="0.01"
                            value={affordabilityValue}
                            onChange={(e) => setAffordabilityValue(parseFloat(e.target.value))}
                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                            <span>(&lt;$10)</span>
                            <span>($10-20)</span>
                            <span>(&gt;$20)</span>
                        </div>
                    </div>

                    <div>
                        <label htmlFor="comments" className="block text-sm font-medium text-gray-700 mb-1">
                            Additional Comments
                        </label>
                        <input
                            id="comments"
                            type="text"
                            value={comments}
                            onChange={(e) => setComments(e.target.value)}
                            placeholder="Any additional preferences"
                            className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Compare Mode Toggle */}
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md border">
                        <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-700">A/B Compare Mode</span>
                            <span className="text-xs text-gray-500">Compare standard vs Cohere rerank</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setGuidedCompareMode(!guidedCompareMode)}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                guidedCompareMode ? 'bg-blue-600' : 'bg-gray-300'
                            }`}
                        >
                            <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                    guidedCompareMode ? 'translate-x-6' : 'translate-x-1'
                                }`}
                            />
                        </button>
                    </div>

                    <button
                        type="button"
                        onClick={handleGuidedSearch}
                        className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 transition"
                        disabled={loading}
                    >
                        {loading ? 'Searching...' : guidedCompareMode ? 'Compare Search Methods' : 'Search'}
                    </button>
                </form>
            ) : (
                <FreeSearch onSearch={handleFreeSearch} loading={loading} />
            )}

            {loading && (
                <div className="mt-4 text-center">
                    <img
                        src="/output-onlinegiftools.gif"
                        alt="Cooking animation"
                        className="mx-auto h-16"
                    />
                </div>
            )}
            {error && <div className="mt-4 text-red-500 text-center">{error}</div>}

            {/* Comparison Mode: Side-by-side results */}
            {compareMode && (standardResults.length > 0 || rerankedResults.length > 0) ? (
                <div className="mt-6 w-full max-w-5xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Standard Results Column */}
                        <div>
                            <h3 className="text-lg font-bold mb-3 text-center bg-gray-200 p-2 rounded-t-md">
                                Standard Search
                                <span className="block text-xs font-normal text-gray-600">
                                    (Embedding + Recency)
                                </span>
                            </h3>
                            <div className="space-y-3">
                                {standardResults.map((stall, index) => (
                                    <div
                                        key={`standard-${stall.place_id}`}
                                        className="p-3 bg-white rounded-md shadow border-l-4 border-gray-400"
                                    >
                                        <div className="flex items-start gap-2">
                                            <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded">
                                                #{index + 1}
                                            </span>
                                            <div className="flex-1">
                                                <h2 className="text-md font-semibold">{stall.name}</h2>
                                                <p className="text-xs text-gray-600">{stall.cuisine} · {stall.affordability}</p>
                                                {stall.similarity && (
                                                    <p className="text-xs text-gray-500">
                                                        Similarity: {(stall.similarity * 100).toFixed(1)}%
                                                    </p>
                                                )}
                                                <p className="text-xs text-gray-600 mt-1">
                                                    <a
                                                        href={`https://maps.google.com/maps?q=${encodeURIComponent(stall.name)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-500 hover:underline"
                                                    >
                                                        {stall.location || "View on Maps"}
                                                    </a>
                                                </p>
                                                {stall.source && (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Source: {stall.source.split(',').map((src, idx) => {
                                                            const urls = stall.source_url?.split(';') || [];
                                                            const url = idx < urls.length ? urls[idx].trim() : '';
                                                            return (
                                                                <Fragment key={idx}>
                                                                    {idx > 0 && ', '}
                                                                    {url ? (
                                                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                                                            {src.trim()}
                                                                        </a>
                                                                    ) : src.trim()}
                                                                </Fragment>
                                                            );
                                                        })}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Reranked Results Column */}
                        <div>
                            <h3 className="text-lg font-bold mb-3 text-center bg-blue-100 p-2 rounded-t-md">
                                Cohere Rerank
                                <span className="block text-xs font-normal text-blue-600">
                                    (Cross-encoder reranking)
                                </span>
                            </h3>
                            <div className="space-y-3">
                                {rerankedResults.map((stall, index) => (
                                    <div
                                        key={`reranked-${stall.place_id}`}
                                        className="p-3 bg-white rounded-md shadow border-l-4 border-blue-500"
                                    >
                                        <div className="flex items-start gap-2">
                                            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">
                                                #{index + 1}
                                            </span>
                                            <div className="flex-1">
                                                <h2 className="text-md font-semibold">{stall.name}</h2>
                                                <p className="text-xs text-gray-600">{stall.cuisine} · {stall.affordability}</p>
                                                {stall.cohereScore !== undefined && (
                                                    <p className="text-xs text-blue-600">
                                                        Rerank Score: {(stall.cohereScore * 100).toFixed(1)}%
                                                    </p>
                                                )}
                                                <p className="text-xs text-gray-600 mt-1">
                                                    <a
                                                        href={`https://maps.google.com/maps?q=${encodeURIComponent(stall.name)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-500 hover:underline"
                                                    >
                                                        {stall.location || "View on Maps"}
                                                    </a>
                                                </p>
                                                {stall.source && (
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Source: {stall.source.split(',').map((src, idx) => {
                                                            const urls = stall.source_url?.split(';') || [];
                                                            const url = idx < urls.length ? urls[idx].trim() : '';
                                                            return (
                                                                <Fragment key={idx}>
                                                                    {idx > 0 && ', '}
                                                                    {url ? (
                                                                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
                                                                            {src.trim()}
                                                                        </a>
                                                                    ) : src.trim()}
                                                                </Fragment>
                                                            );
                                                        })}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : results.length > 0 ? (
                /* Normal Mode: Single column results */
                <div className="mt-6 w-full max-w-md space-y-4">
                    {results.map((stall, index) => (
                        <div
                            key={stall.place_id}
                            className="p-4 bg-white rounded-md shadow"
                        >
                            <h2 className="text-lg font-semibold">{stall.name}</h2>
                            <p className="text-sm text-gray-600">
                                {stall.distance !== null ?
                                    `Distance: ${stall.distance.toFixed(2)} km` :
                                    "Distance: Not available"}
                            </p>
                            <p className="text-sm text-gray-600">Cuisine: {stall.cuisine}</p>
                            <p className="text-sm text-gray-600">Price: {stall.affordability}</p>

                            {/* Location link that opens Google Maps */}
                            <p className="text-sm text-gray-600">
                                Location: {
                                    (() => {
                                        const isNonSpecificLocation = !stall.location ||
                                            /(?:not|Not|NOT)\s+(?:specified|Specified|SPECIFIED|available|Available|AVAILABLE)|(?:n\/?a|N\/?A)|(?:unknown|Unknown|UNKNOWN)|(?:nil|Nil|NIL)/i.test(stall.location);

                                        const displayText = isNonSpecificLocation && stall.latitude && stall.longitude ?
                                            `${stall.latitude.toFixed(5)}, ${stall.longitude.toFixed(5)}` :
                                            (stall.location || "Search on Maps");

                                        return (
                                            <a
                                                href={`https://maps.google.com/maps?q=${encodeURIComponent(stall.name)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-blue-500 hover:underline"
                                                onClick={() => trackResultClick(`${stall.name} (Location)`, index + 1)}
                                            >
                                                {displayText}
                                            </a>
                                        );
                                    })()
                                }
                            </p>

                            {stall.review_summary && (
                                <div className="mt-2">
                                    <details>
                                        <summary className="text-blue-600 cursor-pointer">Review Summary</summary>
                                        <p className="mt-1 text-sm text-gray-700">{stall.review_summary}</p>
                                    </details>
                                </div>
                            )}

                            <details className="mt-2">
                                <summary className="text-blue-600 cursor-pointer">Recommended Dishes</summary>
                                <ul className="list-disc pl-5 mt-1 text-sm">
                                    {Array.isArray(stall.recommended_dishes) ?
                                        stall.recommended_dishes.map((dish, idx) => (
                                            <li key={idx}>{dish}</li>
                                        )) :
                                        <li>{stall.recommended_dishes}</li>
                                    }
                                </ul>
                            </details>
                            <div className="mt-2">
                                <span className="text-sm text-gray-600">
                                    Source:
                                    {stall.source.split(',').map((sourceName, idx) => {
                                        const trimmedName = sourceName.trim();
                                        const urls = stall.source_url.split(';');
                                        const url = idx < urls.length ? urls[idx].trim() : '';

                                        return (
                                            <Fragment key={idx}>
                                                {idx > 0 && ', '}
                                                {url ? (
                                                    <a
                                                        href={url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-500 hover:underline ml-1"
                                                        onClick={() => trackResultClick(`${stall.name} (${trimmedName})`, idx + 1)}
                                                    >
                                                        {trimmedName}
                                                    </a>
                                                ) : (
                                                    <span className="ml-1">{trimmedName}</span>
                                                )}
                                            </Fragment>
                                        );
                                    })}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                !loading && !error && !compareMode && <div className="mt-4 text-center">No results found. Try adjusting your search criteria.</div>
            )}
            <div className="mt-8 mb-4">
                <a
                    href="https://forms.gle/4QZwsefe3HNvTN6Y6"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                >
                    Give feedback
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 ml-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M14 5l7 7m0 0l-7 7m7-7H3"
                        />
                    </svg>
                </a>
            </div>
        </div>
    );
}