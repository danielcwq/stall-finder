type EventParams = {
    action: string;
    category: string;
    label?: string;
    value?: number;
    [key: string]: any;
};

// Track custom events
export const trackEvent = ({ action, category, label, value, ...rest }: EventParams) => {
    if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', action, {
            event_category: category,
            event_label: label,
            value: value,
            ...rest,
        });
    }
};

// Track search events
export const trackSearch = (query: string, mode: 'free' | 'guided' | 'free-compare', resultsCount: number) => {
    trackEvent({
        action: 'search',
        category: `search_${mode}`,
        label: query,
        value: resultsCount,
        search_term: query,
    });
};

// Track result clicks
export const trackResultClick = (stallName: string, position: number) => {
    trackEvent({
        action: 'click',
        category: 'search_result',
        label: stallName,
        position: position,
    });
};