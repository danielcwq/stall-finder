import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';
import { generateEmbedding } from '../../services/embeddingService';
import OpenAI from 'openai';

console.log('Environment variables check:', {
    supabaseUrl: process.env.SUPABASE_URL ? 'defined' : 'undefined',
    supabaseKey: process.env.SUPABASE_ANON_KEY ? 'defined' : 'undefined',
    openaiKey: process.env.OPENAI_API_KEY ? 'defined' : 'undefined'
});

// More robust Supabase client initialization
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    throw new Error('Supabase configuration is incomplete');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Haversine formula to calculate distance between two points on Earth
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

// Convert proximity string to kilometers
function proximityToKm(proximity: string): number {
    if (!proximity) return Infinity;
    const value = parseInt(proximity.split(' ')[0]);
    return value || Infinity;
}

// Hybrid search function
async function performHybridSearch(query: string, latitude: number, longitude: number) {
    // Generate embedding for semantic search
    const embedding = await generateEmbedding(query);

    // Perform hybrid search using Supabase with the new embedding column
    const { data: results, error } = await supabase.rpc('match_stalls_hybrid_e5', {
        query_text: query,
        query_embedding: embedding,
        match_threshold: 0.3,
        match_count: 5,
        user_latitude: latitude,
        user_longitude: longitude
    });

    if (error) throw error;
    return results;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { mode, query, latitude, longitude, cuisine, proximity, affordability, comments } = req.body;

    if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Location coordinates are required' });
    }

    try {
        if (mode === 'free') {
            // Use hybrid search for free text queries
            const results = await performHybridSearch(query, latitude, longitude);
            return res.status(200).json(results);
        } else {
            // Guided search logic
            let queryBuilder = supabase.from('stalls').select('*');

            if (cuisine) {
                queryBuilder = queryBuilder.ilike('cuisine', `%${cuisine}%`);
            }

            if (affordability) {
                let affordabilityValues = [];
                switch (affordability) {
                    case '$':
                        affordabilityValues = ['Affordable (< S$10)'];
                        break;
                    case '$$':
                        affordabilityValues = ['Affordable (< S$10)', 'Mid-Range (S$10–S$20)'];
                        break;
                    case '$$$':
                        affordabilityValues = ['Mid-Range (S$10–S$20)', 'Premium (> S$20)'];
                        break;
                    default:
                        affordabilityValues = [affordability];
                }
                queryBuilder = queryBuilder.in('affordability', affordabilityValues);
            }

            const { data: stalls, error: queryError } = await queryBuilder;
            if (queryError) throw queryError;

            // Filter by proximity
            const maxDistance = proximityToKm(proximity);
            let filteredStalls = stalls
                .map(stall => ({
                    ...stall,
                    distance: calculateDistance(
                        latitude,
                        longitude,
                        stall.latitude,
                        stall.longitude
                    )
                }))
                .filter(stall => stall.distance <= maxDistance);

            // Apply semantic search if comments provided
            if (comments && comments.trim() && filteredStalls.length > 0) {
                const embedding = await generateEmbedding(comments);

                const { data: semanticResults, error: semanticError } = await supabase.rpc(
                    'match_stalls_e5',
                    {
                        query_embedding: embedding,
                        match_threshold: 0.3,
                        match_count: 20
                    }
                );

                if (!semanticError && semanticResults) {
                    const semanticScores = new Map(
                        semanticResults.map(item => [item.place_id, item.similarity])
                    );

                    filteredStalls = filteredStalls.map(stall => ({
                        ...stall,
                        semanticScore: semanticScores.get(stall.place_id) || 0,
                        adjustedDistance: Number(stall.distance) * (1 - Number(semanticScores.get(stall.place_id) || 0) * 0.5)
                    }));

                    // Sort by adjusted distance
                    filteredStalls.sort((a, b) => a.adjustedDistance - b.adjustedDistance);
                }
            } else {
                // Sort by actual distance if no semantic search
                filteredStalls.sort((a, b) => a.distance - b.distance);
            }

            // Return top 5 results
            const results = filteredStalls.slice(0, 5).map(stall => ({
                place_id: stall.place_id,
                name: stall.name,
                distance: stall.distance,
                cuisine: stall.cuisine,
                affordability: stall.affordability,
                recommended_dishes: stall.recommended_dishes,
                source: stall.source,
                source_url: stall.source_url
            }));

            return res.status(200).json(results);
        }
    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({ error: 'An error occurred during search' });
    }
}