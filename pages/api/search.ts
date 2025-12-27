import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { CohereClient } from 'cohere-ai';

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

const cohere = new CohereClient({
    token: process.env.COHERE_API_KEY,
});

// Type definition for stall records
interface Stall {
    place_id: string;
    name: string;
    latitude: number;
    longitude: number;
    cuisine: string;
    affordability: string;
    recommended_dishes?: string[];
    review_summary: string;
    source: string;
    source_url: string;
    date_published: string;
    location: string;
    status: string;
    similarity?: number;
    distance?: number | null;
    recencyScore?: number;
    cohereScore?: number;
}

// Build document text for Cohere reranking
function buildDocumentText(stall: Stall): string {
    return [
        stall.name,
        stall.cuisine,
        stall.affordability,
        stall.review_summary,
        stall.recommended_dishes ? `Dishes: ${stall.recommended_dishes.join(', ')}` : '',
    ].filter(Boolean).join('. ');
}

// Rerank results using Cohere
async function rerankResults(query: string, candidates: Stall[]): Promise<Stall[]> {
    if (candidates.length === 0) return [];

    try {
        const response = await cohere.rerank({
            model: 'rerank-v3.5',
            query: query,
            documents: candidates.map(stall => ({
                text: buildDocumentText(stall)
            })),
            topN: 10,
            returnDocuments: false
        });

        // Reorder candidates based on Cohere scores
        return response.results.map(result => ({
            ...candidates[result.index],
            cohereScore: result.relevanceScore
        }));
    } catch (error) {
        console.error('Cohere rerank error:', error);
        // Fallback to original order if rerank fails
        return candidates.slice(0, 10);
    }
}

// Calculate recency score based on publication date
function calculateRecencyScore(datePublished: string): number {
    if (!datePublished) return 0;

    const publishDate = new Date(datePublished);
    const now = new Date();

    // Calculate difference in days
    const diffTime = now.getTime() - publishDate.getTime();
    const diffDays = diffTime / (1000 * 3600 * 24);

    // Exponential decay function - adjust the 365 value to control how quickly older entries are penalized
    // This gives a score of ~0.37 for entries 1 year old, ~0.14 for 2 years old, etc.
    return Math.exp(-diffDays / 365);
}

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
    const value = parseFloat(proximity.split(' ')[0]);
    return value || Infinity;
}

// Helper to format stall results for response
function formatStallResult(stall: any) {
    return {
        place_id: stall.place_id,
        name: stall.name,
        distance: stall.distance ?? null,
        cuisine: stall.cuisine,
        affordability: stall.affordability,
        recommended_dishes: stall.recommended_dishes,
        source: stall.source,
        source_url: stall.source_url,
        date_published: stall.date_published,
        recencyScore: stall.recencyScore,
        review_summary: stall.review_summary,
        location: stall.location,
        cohereScore: stall.cohereScore,
        similarity: stall.similarity
    };
}

async function performSemanticOnlySearch(query: string, compare: boolean = false) {
    const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Use match_stalls - get more candidates when comparing
    const { data: results, error } = await supabase.rpc('match_stalls', {
        query_embedding: embedding,
        match_threshold: compare ? 0.2 : 0.3,  // Lower threshold for more candidates
        match_count: compare ? 50 : 10          // More candidates for reranking
    });

    if (error) throw error;

    // Process results without distance calculation
    const processedResults = results.map(stall => {
        const recencyScore = calculateRecencyScore(stall.date_published);
        return {
            ...stall,
            distance: null,
            recencyScore,
            adjustedSimilarity: (stall.similarity * 0.7) + (recencyScore * 0.3)
        };
    });

    // Sort by adjusted similarity for standard results
    const standardResults = [...processedResults]
        .sort((a, b) => b.adjustedSimilarity - a.adjustedSimilarity)
        .slice(0, 10)
        .map(formatStallResult);

    if (compare) {
        // Get reranked results
        const rerankedResults = await rerankResults(query, processedResults);
        const formattedReranked = rerankedResults.slice(0, 10).map(formatStallResult);

        return {
            standard: standardResults,
            reranked: formattedReranked
        };
    }

    return standardResults;
}

// Hybrid search function
async function performHybridSearch(query: string, latitude: number, longitude: number, compare: boolean = false) {
    // Generate embedding for semantic search
    const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: query,
    });

    const embedding = embeddingResponse.data[0].embedding;

    // Use match_stalls - get more candidates when comparing
    const { data: results, error } = await supabase.rpc('match_stalls', {
        query_embedding: embedding,
        match_threshold: compare ? 0.2 : 0.3,
        match_count: compare ? 50 : 10
    });

    if (error) throw error;

    // Process results with safe distance calculation
    const processedResults = results.map(stall => {
        let distance: number | null = null;
        let recencyScore = 0;

        try {
            if (stall.latitude && stall.longitude &&
                !isNaN(stall.latitude) && !isNaN(stall.longitude) &&
                !isNaN(latitude) && !isNaN(longitude)) {
                distance = calculateDistance(
                    latitude,
                    longitude,
                    stall.latitude,
                    stall.longitude
                );
            }
            recencyScore = calculateRecencyScore(stall.date_published);
        } catch (e) {
            console.error('Error calculating metrics:', e);
        }

        return {
            ...stall,
            distance,
            recencyScore,
            adjustedSimilarity: (stall.similarity * 0.7) + (recencyScore * 0.3)
        };
    });

    // Sort by adjusted similarity for standard results
    const standardResults = [...processedResults]
        .sort((a, b) => b.adjustedSimilarity - a.adjustedSimilarity)
        .slice(0, 10)
        .map(formatStallResult);

    if (compare) {
        // Get reranked results
        const rerankedResults = await rerankResults(query, processedResults);
        const formattedReranked = rerankedResults.slice(0, 10).map(formatStallResult);

        return {
            standard: standardResults,
            reranked: formattedReranked
        };
    }

    return standardResults;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { mode, query, latitude, longitude, cuisine, proximity, affordability, comments, compare } = req.body;

    //if (!latitude || !longitude) {
    //    return res.status(400).json({ error: 'Location coordinates are required' });
    //}

    try {
        if (mode === 'free') {
            // Use semantic-only search when location isn't available
            const hasLocation = latitude !== null && longitude !== null;
            const results = hasLocation
                ? await performHybridSearch(query, latitude, longitude, compare)
                : await performSemanticOnlySearch(query, compare);
            return res.status(200).json(results);
        } else {
            // For guided search, still require location
            if (!latitude || !longitude) {
                return res.status(400).json({
                    error: 'Location coordinates are required for guided search'
                });
            }
            let queryBuilder = supabase.from('stalls').select('*').eq('status', 'open');

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
                    ),
                    recencyScore: calculateRecencyScore(stall.date_published)
                }))
                .filter(stall => stall.distance <= maxDistance);

            // Apply semantic search if comments provided
            if (comments && comments.trim() && filteredStalls.length > 0) {
                const embeddingResponse = await openai.embeddings.create({
                    model: "text-embedding-3-small",
                    input: comments,
                });

                const embedding = embeddingResponse.data[0].embedding;

                const { data: semanticResults, error: semanticError } = await supabase.rpc(
                    'match_stalls',
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
                        // Adjust distance by semantic relevance and recency
                        // 60% weight to distance, 30% to semantic, 10% to recency
                        adjustedDistance: Number(stall.distance) *
                            (1 - (Number(semanticScores.get(stall.place_id) || 0) * 0.3) - (stall.recencyScore * 0.1))
                    }));

                    // Sort by adjusted distance
                    filteredStalls.sort((a, b) => a.adjustedDistance - b.adjustedDistance);
                }
            } else {
                // If no semantic search, still consider recency
                filteredStalls = filteredStalls.map(stall => ({
                    ...stall,
                    // 90% weight to distance, 10% to recency
                    adjustedDistance: Number(stall.distance) * (1 - (stall.recencyScore * 0.1))
                }));

                // Sort by adjusted distance
                filteredStalls.sort((a, b) => a.adjustedDistance - b.adjustedDistance);
            }

            // Return top 5 results
            const results = filteredStalls.slice(0, 10).map(stall => ({
                place_id: stall.place_id,
                name: stall.name,
                distance: stall.distance,
                cuisine: stall.cuisine,
                affordability: stall.affordability,
                recommended_dishes: stall.recommended_dishes,
                source: stall.source,
                source_url: stall.source_url,
                date_published: stall.date_published,
                recencyScore: stall.recencyScore,
                review_summary: stall.review_summary,
                location: stall.location
            }));

            return res.status(200).json(results);
        }
    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({ error: 'An error occurred during search' });
    }
}