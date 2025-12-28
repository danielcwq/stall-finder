import { useState } from 'react';

interface AgentFreeSearchProps {
    onSearch: (query: string) => void;
    loading: boolean;
}

export default function AgentFreeSearch({ onSearch, loading }: AgentFreeSearchProps) {
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
                placeholder="Try: 'spicy laksa near Bugis' or 'cheap chicken rice near me' or 'chindamani indian restaurant'"
                className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                rows={4}
            />

            {/* Agent Info Box */}
            <div className="p-3 bg-purple-50 rounded-md border border-purple-200">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-purple-700">Agent-Powered Search</span>
                    <span className="text-xs bg-purple-200 text-purple-700 px-1.5 py-0.5 rounded">Beta</span>
                </div>
                <p className="text-xs text-purple-600">
                    Understands location names, cuisine types, and price preferences from natural language
                </p>
            </div>

            <button
                type="submit"
                className="w-full bg-purple-600 text-white p-2 rounded-md hover:bg-purple-700 transition"
                disabled={loading || !query.trim()}
            >
                {loading ? 'Agent is thinking...' : 'Search with Agent'}
            </button>
        </form>
    );
}
