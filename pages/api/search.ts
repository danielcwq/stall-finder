import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

// Initialize OpenAI client for embeddings
// Add this logging to debug environment variables
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { latitude, longitude, cuisine, proximity, affordability, comments } = req.body;

    if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Location coordinates are required' });
    }

    try {
        // Step 1: Basic filtering
        let query = supabase.from('stalls').select('*');

        if (cuisine) query = query.eq('cuisine', cuisine);
        if (affordability) query = query.eq('affordability', affordability);

        const { data: stalls, error } = await query;
        if (error) throw error;

        // Step 2: Calculate distance for each stall and filter by proximity
        const maxDistance = proximityToKm(proximity);
        let filteredStalls = stalls
            .map(stall => {
                const distance = calculateDistance(
                    latitude,
                    longitude,
                    stall.latitude,
                    stall.longitude
                );
                return { ...stall, distance };
            })
            .filter(stall => stall.distance <= maxDistance);

        // Step 3: If comments provided, perform semantic search
        if (comments && comments.trim() && filteredStalls.length > 0) {
            // Generate embedding for the search query
            const embeddingResponse = await openai.embeddings.create({
                model: "text-embedding-3-small",
                input: comments,
            });

            const embedding = embeddingResponse.data[0].embedding;

            // Perform vector similarity search
            const { data: semanticResults, error: semanticError } = await supabase.rpc(
                'match_stalls',
                {
                    query_embedding: embedding,
                    match_threshold: 0.5,
                    match_count: 10
                }
            );

            if (semanticError) throw semanticError;

            // Merge results by giving priority to distance but boosting semantic matches
            if (semanticResults && semanticResults.length > 0) {
                // Create a map of semantic search results with their similarity scores
                // Check the actual structure of semanticResults to use the correct ID field
                console.log("Semantic results structure:", semanticResults[0]);

                const semanticScores = new Map(
                    semanticResults.map(item => [item.place_id || item.id, item.similarity])
                );

                // Boost stalls that match semantic search
                filteredStalls = filteredStalls.map(stall => {
                    // Try to match using place_id
                    const semanticScore = semanticScores.get(stall.place_id) || 0;
                    // Convert to number and ensure it's a valid number
                    const scoreValue = typeof semanticScore === 'number' ? semanticScore : 0;
                    const adjustedDistance = stall.distance * (1 - scoreValue * 0.5);
                    return { ...stall, adjustedDistance };
                });
            }
        }

        // Sort by distance (or adjusted distance if semantic search was used)
        const sortField = comments && comments.trim() ? 'adjustedDistance' : 'distance';
        const results = filteredStalls
            .sort((a, b) => a[sortField] - b[sortField])
            .slice(0, 5)
            .map(stall => ({
                place_id: stall.place_id,
                name: stall.name,
                distance: stall.distance,
                cuisine: stall.cuisine,
                affordability: stall.affordability,
                recommended_dishes: stall.recommended_dishes,
                source: stall.source,
                source_url: stall.source_url
            }));

        res.status(200).json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to fetch stalls' });
    }
}