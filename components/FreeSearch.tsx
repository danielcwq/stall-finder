import { useState } from 'react';

interface FreeSearchProps {
    onSearch: (query: string, compare: boolean, useAgent: boolean) => void;
    loading: boolean;
}

export default function FreeSearch({ onSearch, loading }: FreeSearchProps) {
    const [compareMode, setCompareMode] = useState(false);
    const [useAgent, setUseAgent] = useState(false);

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const query = formData.get('query') as string;
        onSearch(query, compareMode, useAgent);
    };

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
            <textarea
                name="query"
                placeholder="What are you looking for? (e.g., 'Spicy noodles near me' or 'Affordable Chinese food with good reviews')"
                className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
            />

            {/* Use Agent Toggle */}
            <div className={`flex items-center justify-between p-3 rounded-md border ${
                useAgent ? 'bg-purple-100 border-purple-300' : 'bg-purple-50 border-purple-200'
            }`}>
                <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-purple-700">Use Agent</span>
                        <span className="text-xs bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded">Beta</span>
                    </div>
                    <span className="text-xs text-purple-600">AI-powered search with location understanding</span>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setUseAgent(!useAgent);
                        if (!useAgent) setCompareMode(false); // Disable compare when using agent
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        useAgent ? 'bg-purple-600' : 'bg-gray-300'
                    }`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            useAgent ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                </button>
            </div>

            {/* Compare Mode Toggle - disabled when using agent */}
            <div className={`flex items-center justify-between p-3 rounded-md border ${
                useAgent ? 'bg-gray-100 opacity-50' : 'bg-gray-50'
            }`}>
                <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-700">A/B Compare Mode</span>
                    <span className="text-xs text-gray-500">
                        {useAgent ? 'Disabled when using Agent' : 'Compare standard vs Cohere rerank'}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={() => setCompareMode(!compareMode)}
                    disabled={useAgent}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        useAgent ? 'cursor-not-allowed' : ''
                    } ${
                        compareMode && !useAgent ? 'bg-blue-600' : 'bg-gray-300'
                    }`}
                >
                    <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            compareMode && !useAgent ? 'translate-x-6' : 'translate-x-1'
                        }`}
                    />
                </button>
            </div>

            <button
                type="submit"
                className={`w-full text-white p-2 rounded-md transition ${
                    useAgent
                        ? 'bg-purple-600 hover:bg-purple-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                }`}
                disabled={loading}
            >
                {loading
                    ? 'Searching...'
                    : useAgent
                        ? 'Search with Agent'
                        : compareMode
                            ? 'Compare Search Methods'
                            : 'Search'}
            </button>
        </form>
    );
}