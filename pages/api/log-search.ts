import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';

// Supabase client initialization
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    throw new Error('Supabase configuration is incomplete');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const {
            search_mode,
            query,
            cuisine,
            proximity,
            affordability,
            comments,
            latitude,
            longitude,
            results_count
        } = req.body;

        // Get user agent from request headers
        const userAgent = req.headers['user-agent'] || '';

        // Get IP address (with consideration for proxies)
        const forwarded = req.headers['x-forwarded-for'];
        const ip = forwarded ?
            (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0]) :
            req.socket.remoteAddress;

        // Insert log into Supabase
        const { data, error } = await supabase
            .from('search_logs')
            .insert([
                {
                    search_mode,
                    query,
                    cuisine,
                    proximity,
                    affordability,
                    comments,
                    latitude,
                    longitude,
                    results_count,
                    user_agent: userAgent,
                    ip_address: ip
                }
            ]);

        if (error) throw error;

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error('Logging error:', error);
        return res.status(500).json({ error: 'Failed to log search' });
    }
}