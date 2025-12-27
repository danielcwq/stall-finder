import { useState } from 'react';

interface FreeSearchProps {
    onSearch: (query: string, compare: boolean) => void;
    loading: boolean;
}

export default function FreeSearch({ onSearch, loading }: FreeSearchProps) {
    const [compareMode, setCompareMode] = useState(false);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const query = formData.get('query') as string;
        onSearch(query, compareMode);
    };

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
            <textarea
                name="query"
                placeholder="What are you looking for? (e.g., 'Spicy noodles near me' or 'Affordable Chinese food with good reviews')"
                className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
            />

            {/* Compare Mode Toggle */}
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-md border">
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-700">A/B Compare Mode</span>
                    <span className="text-xs text-gray-500">Compare standard vs Cohere rerank</span>
                </div>
                <button
                    type="button"
                    onClick={() => setCompareMode(!compareMode)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        compareMode ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            compareMode ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                </button>
            </div>

            <button
                type="submit"
                className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 transition"
                disabled={loading}
            >
                {loading ? 'Searching...' : compareMode ? 'Compare Search Methods' : 'Search'}
            </button>
        </form>
    );
}