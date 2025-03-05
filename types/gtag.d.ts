// Type definitions for Google Analytics gtag
interface Window {
    gtag: (
        command: 'event' | 'config' | 'consent' | 'set',
        targetId: string,
        params?: {
            [key: string]: any;
        }
    ) => void;
}