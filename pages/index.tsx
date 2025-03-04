import { useState } from 'react';
import useLocation from '../hooks/useLocation';

export default function Home() {
    const { location, error: locError } = useLocation();
    const [cuisine, setCuisine] = useState('');
    const [proximity, setProximity] = useState('');
    const [affordability, setAffordability] = useState('');
    const [comments, setComments] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const cuisines = ['Chinese', 'Western', 'Indian', 'Japanese', 'Others'];
    const proximities = ['1 km', '5 km', '10 km', '25 km'];
    const affordabilities = ['$', '$$', '$$$', '$$$$'];

    const handleSearch = async () => {
        setLoading(true);
        setError(null);
        setResults([]);

        try {
            const response = await fetch('/api/search', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    latitude: location?.latitude,
                    longitude: location?.longitude,
                    cuisine,
                    proximity,
                    affordability,
                    comments,
                }),
            });

            if (!response.ok) throw new Error('Search failed');
            const data = await response.json();
            setResults(data);
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (locError) return <div className="text-red-500 text-center p-4">{locError}</div>;
    if (!location) return <div className="text-center p-4">Loading location...</div>;

    return (
        <div className="flex flex-col items-center min-h-screen p-4 bg-gray-100">
            <h1 className="text-2xl font-bold mb-6">Find Food Stalls</h1>
            <form className="w-full max-w-md space-y-4">
                {/* Form fields as above */}
                <select value={cuisine} onChange={(e) => setCuisine(e.target.value)} className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Cuisine">
                    <option value="">Select Cuisine</option>
                    {cuisines.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={proximity} onChange={(e) => setProximity(e.target.value)} className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Proximity">
                    <option value="">Select Proximity</option>
                    {proximities.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={affordability} onChange={(e) => setAffordability(e.target.value)} className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" aria-label="Affordability">
                    <option value="">Select Affordability</option>
                    {affordabilities.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <input
                    type="text"
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    placeholder="Any additional comments"
                    className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    aria-label="Additional comments"
                />
                <button type="button" onClick={handleSearch} className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 transition">
                    Search
                </button>
            </form>

            {loading && <div className="mt-4 text-center">Loading...</div>}
            {error && <div className="mt-4 text-red-500 text-center">{error}</div>}
            {results.length > 0 ? (
                <div className="mt-6 w-full max-w-md space-y-4">
                    {results.map((stall) => (
                        <div key={stall.place_id} className="p-4 bg-white rounded-md shadow">
                            <h2 className="text-lg font-semibold">{stall.name}</h2>
                            <p className="text-sm text-gray-600">Distance: {stall.distance.toFixed(2)} km</p>
                            <p className="text-sm text-gray-600">Cuisine: {stall.cuisine}</p>
                            <p className="text-sm text-gray-600">Price: {stall.affordability}</p>
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
                            <a
                                href={stall.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 text-sm hover:underline"
                            >
                                Source: {stall.source}
                            </a>
                        </div>
                    ))}
                </div>
            ) : (
                !loading && !error && <div className="mt-4 text-center">No results found. Try adjusting your search criteria.</div>
            )}
        </div>
    );
}