import '../styles/global.css'
import type { AppProps } from 'next/app'
import GoogleAnalytics from '../components/GoogleAnalytics'
import Head from 'next/head'

function MyApp({ Component, pageProps }: AppProps) {
    return (
        <>
            <Head>
                <title>Ho Jiak Bo</title>
                <link rel="icon" href="/output-onlinegiftools.gif" type="image/gif" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <meta name="description" content="Find delicious food stalls from Singapore food blogs near you" />
            </Head>
            <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
            <Component {...pageProps} />
        </>
    )
}

export default MyApp