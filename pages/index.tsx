import { useState, useEffect, Fragment } from 'react';
import { trackSearch, trackResultClick } from '../utils/analytics';
import useLocation from '../hooks/useLocation';
import SearchTabs from '../components/SearchTabs';
import FreeSearch from '../components/FreeSearch';

export default function Home() {
    const { location, error: locError, isLoading } = useLocation();
    const [cuisine, setCuisine] = useState('');
    const [proximity, setProximity] = useState('');
    const [proximityValue, setProximityValue] = useState(5); // Default to 5km
    const [affordability, setAffordability] = useState('');
    const [affordabilityValue, setAffordabilityValue] = useState(2); // Default to 2 ($$)
    const [comments, setComments] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'guided' | 'free'>('guided');
    const [showExplanation, setShowExplanation] = useState(false);

    const cuisines = ['Chinese', 'Western', 'Indian', 'Japanese', 'Malay', 'Korean', 'Others'];
    const proximities = ['1 km', '5 km', '10 km', '25 km'];
    const affordabilities = ['$', '$$', '$$$'];

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

    const handleFreeSearch = async (query: string) => {
        setLoading(true);
        setError(null);
        setResults([]);

        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    mode: 'free',
                    latitude: location ? location.latitude : null,
                    longitude: location ? location.longitude : null,
                }),
            });

            if (!response.ok) throw new Error('Search failed');
            const data = await response.json();
            setResults(data);

            // Track the search event
            trackSearch(query, 'free', data.length);

            // Log the search to Supabase
            logSearch({
                search_mode: 'free',
                query,
                cuisine: null,
                proximity: null,
                affordability: null,
                comments: null,
                latitude: location ? location.latitude : null,
                longitude: location ? location.longitude : null,
                results_count: data.length
            });
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };


    const handleGuidedSearch = async () => {
        if (!location) {
            setError('Location is required for search. Please allow location access.');
            return;
        }

        setLoading(true);
        setError(null);
        setResults([]);

        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    mode: 'guided',
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
            setResults(data);

            // Track the guided search
            trackSearch(
                `Cuisine: ${cuisine}, Proximity: ${proximity}, Affordability: ${affordability}, Comments: ${comments}`,
                'guided',
                data.length
            );

            // Log the search to Supabase
            logSearch({
                search_mode: 'guided',
                query: null,
                cuisine,
                proximity,
                affordability,
                comments,
                latitude: location.latitude,
                longitude: location.longitude,
                results_count: data.length
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
                    Made with ❤️ by <a href="https://danielching.me" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Daniel Ching</a>
                </div>
            </div>

            {locError && (
                <div className="w-full max-w-md mb-4 p-3 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded">
                    {locError} Search results may be limited without location access.
                </div>
            )}

            {isLoading && (
                <div className="w-full max-w-md mb-4 p-3 bg-blue-100 border border-blue-400 text-blue-700 rounded">
                    Requesting your location...
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

                    <button
                        type="button"
                        onClick={handleGuidedSearch}
                        className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 transition"
                        disabled={loading}
                    >
                        {loading ? 'Searching...' : 'Search'}
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

            {results.length > 0 ? (
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
                                        // Improved regex to catch all case variations of "not specified", "not available", etc.
                                        const isNonSpecificLocation = !stall.location ||
                                            /(?:not|Not|NOT)\s+(?:specified|Specified|SPECIFIED|available|Available|AVAILABLE)|(?:n\/?a|N\/?A)|(?:unknown|Unknown|UNKNOWN)|(?:nil|Nil|NIL)/i.test(stall.location);

                                        // Text to display - use coordinates only when location is non-specific
                                        const displayText = isNonSpecificLocation && stall.latitude && stall.longitude ?
                                            `${stall.latitude.toFixed(5)}, ${stall.longitude.toFixed(5)}` :
                                            (stall.location || "Search on Maps");

                                        // URL for Google Maps - always prioritize coordinates when available
                                        const mapsUrl = stall.latitude && stall.longitude ?
                                            `https://maps.google.com/maps?q=${stall.latitude},${stall.longitude}` :
                                            `https://maps.google.com/maps?q=${encodeURIComponent(stall.name)}`;

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

                            {/* Add review summary */}
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
                                        stall.recommended_dishes.map((dish, index) => (
                                            <li key={index}>{dish}</li>
                                        )) :
                                        <li>{stall.recommended_dishes}</li>
                                    }
                                </ul>
                            </details>
                            <div className="mt-2">
                                <span className="text-sm text-gray-600">
                                    Source:
                                    {stall.source.split(',').map((sourceName, index) => {
                                        const trimmedName = sourceName.trim();
                                        const urls = stall.source_url.split(';');
                                        const url = index < urls.length ? urls[index].trim() : '';

                                        return (
                                            <Fragment key={index}>
                                                {index > 0 && ', '}
                                                {url ? (
                                                    <a
                                                        href={url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-blue-500 hover:underline ml-1"
                                                        onClick={() => trackResultClick(`${stall.name} (${trimmedName})`, index + 1)}
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
                !loading && !error && <div className="mt-4 text-center">No results found. Try adjusting your search criteria.</div>
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