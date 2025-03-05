import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { latitude, longitude, cuisine, proximity, affordability, comments } = req.body;

    // Log incoming request parameters
    console.log('Search request:', { latitude, longitude, cuisine, proximity, affordability, comments });

    if (!latitude || !longitude) {
        return res.status(400).json({ error: 'Location coordinates are required' });
    }

    try {
        // First, check if there are any stalls at all in the database
        const { data: allStalls, error: countError } = await supabase.from('stalls').select('*');
        console.log(`Total stalls in database: ${allStalls?.length || 0}`);

        if (allStalls && allStalls.length > 0) {
            console.log('Sample stall data:', allStalls[0]);

            // Log available cuisines in the database
            const cuisines = Array.from(new Set(allStalls.map(stall => stall.cuisine)));
            console.log('Available cuisines in database:', cuisines);

            // Log available affordability options
            const affordabilityOptions = Array.from(new Set(allStalls.map(stall => stall.affordability)));
            console.log('Available affordability options:', affordabilityOptions);
        }

        // Step 1: Basic filtering - but now with more lenient approach
        let query = supabase.from('stalls').select('*');

        // Only apply filters if we have data that matches
        if (cuisine) {
            // Check if we should apply case-insensitive matching
            query = query.ilike('cuisine', `%${cuisine}%`);
        }

        if (affordability) {
            // Create an array of affordability values to match based on the selected option
            let affordabilityValues = [];

            switch (affordability) {
                case '$':
                    affordabilityValues = ['Affordable (< S$10)'];
                    break;
                case '$$':
                    affordabilityValues = ['Affordable (< S$10)', 'Mid-Range (S$10–S$20)'];
                    break;
                case '$$$':
                    affordabilityValues = ['Affordable (< S$10)', 'Mid-Range (S$10–S$20)', 'Premium (> S$20)'];
                    break;
                default:
                    affordabilityValues = [affordability];
            }

            // Use .in() to match any of the values in the array
            query = query.in('affordability', affordabilityValues);

            console.log('Affordability from UI:', affordability);
            console.log('Mapped affordability values:', affordabilityValues);
        }



        const { data: stalls, error } = await query;
        if (error) throw error;

        // Log initial database results
        console.log(`Initial stalls query returned ${stalls?.length || 0} results`);
        if (stalls && stalls.length > 0) {
            console.log('Sample stall data:', stalls[0]);
        }

        // Step 2: Calculate distance for each stall and filter by proximity
        const maxDistance = proximityToKm(proximity);
        console.log(`Max distance filter: ${maxDistance} km`);

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

        // Log distance filtering results
        console.log(`After distance filtering: ${filteredStalls.length} stalls remain`);

        // Log the first 5 stalls with their distances
        if (filteredStalls.length > 0) {
            console.log('First 5 stalls by distance:');
            filteredStalls.sort((a, b) => a.distance - b.distance)
                .slice(0, 5)
                .forEach((stall, i) => {
                    console.log(`${i + 1}. ${stall.name}: ${stall.distance.toFixed(2)} km`);
                });
        } else {
            console.log('No stalls within the specified distance');
        }

        // Step 3: If comments provided, perform semantic search
        if (comments && comments.trim() && filteredStalls.length > 0) {
            console.log('Performing semantic search with comments:', comments);

            try {
                // Generate embedding for the search query
                const embeddingResponse = await openai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: comments,
                });

                const embedding = embeddingResponse.data[0].embedding;
                console.log('Generated embedding successfully');

                // Perform vector similarity search
                const { data: semanticResults, error: semanticError } = await supabase.rpc(
                    'match_stalls',
                    {
                        query_embedding: embedding,
                        match_threshold: 0.3, // Lower threshold to get more results
                        match_count: 20 // Increase count to get more potential matches
                    }
                );

                if (semanticError) {
                    console.error('Semantic search error:', semanticError);
                    console.log('Continuing without semantic search due to error');
                } else {
                    console.log(`Semantic search returned ${semanticResults?.length || 0} results`);

                    if (semanticResults && semanticResults.length > 0) {
                        // Log the top semantic matches to understand what's being returned
                        console.log('Top semantic matches:');
                        semanticResults.slice(0, 3).forEach((result, i) => {
                            console.log(`${i + 1}. ${result.name}: ${result.similarity.toFixed(4)} similarity`);
                        });

                        // Create a map of semantic search results with their similarity scores
                        const semanticScores = new Map(
                            semanticResults.map(item => [item.place_id, item.similarity])
                        );

                        // Boost stalls that match semantic search
                        filteredStalls = filteredStalls.map(stall => {
                            const semanticScore = semanticScores.get(stall.place_id) || 0;
                            // Convert to number and ensure it's valid
                            const scoreValue = typeof semanticScore === 'number' ? semanticScore : 0;
                            const adjustedDistance = stall.distance * (1 - scoreValue * 0.5);
                            return { ...stall, adjustedDistance, semanticScore: scoreValue };
                        });

                        console.log('Applied semantic boosting to distances');

                        // Log stalls with semantic scores for debugging
                        console.log('Stalls with semantic scores:');
                        filteredStalls.slice(0, 5).forEach((stall, i) => {
                            console.log(`${i + 1}. ${stall.name}: distance=${stall.distance.toFixed(2)}km, semanticScore=${stall.semanticScore || 0}, adjustedDistance=${stall.adjustedDistance.toFixed(2)}`);
                        });
                    } else {
                        // If no semantic results, just use regular distance
                        filteredStalls = filteredStalls.map(stall => ({
                            ...stall,
                            adjustedDistance: stall.distance
                        }));
                        console.log('No semantic matches found, using regular distance sorting');
                    }
                }
            } catch (error) {
                console.error('Error in semantic search:', error);
                console.log('Continuing without semantic search due to exception');

                // If error in semantic search, just use regular distance
                filteredStalls = filteredStalls.map(stall => ({
                    ...stall,
                    adjustedDistance: stall.distance
                }));
            }
        }

        // Sort by distance (or adjusted distance if semantic search was used)
        const sortField = comments && comments.trim() ? 'adjustedDistance' : 'distance';
        console.log(`Sorting results by ${sortField}`);

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

        console.log(`Returning ${results.length} results to client`);
        res.status(200).json(results);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Failed to fetch stalls' });
    }
}