interface FreeSearchProps {
    onSearch: (query: string) => void;
    loading: boolean;
}

export default function FreeSearch({ onSearch, loading }: FreeSearchProps) {
    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const query = formData.get('query') as string;
        onSearch(query);
    };

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
            <textarea
                name="query"
                placeholder="What are you looking for? (e.g., 'Spicy noodles near me' or 'Affordable Chinese food with good reviews')"
                className="w-full p-3 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={4}
            />
            <button
                type="submit"
                className="w-full bg-blue-600 text-white p-2 rounded-md hover:bg-blue-700 transition"
                disabled={loading}
            >
                {loading ? 'Searching...' : 'Search'}
            </button>
        </form>
    );
}