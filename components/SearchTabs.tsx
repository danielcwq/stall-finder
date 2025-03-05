import { ReactNode } from 'react';

interface TabProps {
    activeTab: 'guided' | 'free';
    onTabChange: (tab: 'guided' | 'free') => void;
}

export default function SearchTabs({ activeTab, onTabChange }: TabProps) {
    return (
        <div className="flex mb-6 border-b">
            <button
                className={`px-4 py-2 ${activeTab === 'guided'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500'
                    }`}
                onClick={() => onTabChange('guided')}
            >
                Guided Search
            </button>
            <button
                className={`px-4 py-2 ${activeTab === 'free'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500'
                    }`}
                onClick={() => onTabChange('free')}
            >
                I'm Feeling Lucky
            </button>
        </div>
    );
}