import '../styles/global.css'
import type { AppProps } from 'next/app'
import GoogleAnalytics from '../components/GoogleAnalytics'

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <>
            <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
            <Component {...pageProps} />
        </>
    )
}

export default MyApp