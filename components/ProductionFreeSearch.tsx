import { useState } from 'react';

interface ProductionFreeSearchProps {
    onSearch: (query: string) => void;
    loading: boolean;
}

export default function ProductionFreeSearch({ onSearch, loading }: ProductionFreeSearchProps) {
    const [query, setQuery] = useState('');

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (query.trim()) {
            onSearch(query);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
            <textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What are you looking for? (e.g., 'Spicy noodles near me' or 'Affordable Chinese food with good reviews')"
                className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
            />

            {/* Info Box */}
            <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                <p className="text-xs text-blue-600">
                    Powered by Cohere reranking for better search relevance
                </p>
            </div>

            <button
                type="submit"
                className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 transition"
                disabled={loading || !query.trim()}
            >
                {loading ? 'Searching...' : 'Search'}
            </button>
        </form>
    );
}
