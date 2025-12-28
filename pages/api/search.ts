import { createClient } from '@supabase/supabase-js';
import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { CohereClient } from 'cohere-ai';

// Agent search imports
import {
    parseQuery,
    geocode,
    rankWithLLM,
    createEmptyTrace,
    addTraceError,
    finalizeTrace,
    logTraceToConsole,
    logTraceToSupabase,
    createTraceSummary,
    AGENT_CONFIG,
    Stall as AgentStall,
    Coords,
} from '../../utils/agent';

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

// Agent-powered search function
async function performAgentSearch(
    query: string,
    userLocation: Coords | null,
    debug: boolean = false
) {
    const trace = createEmptyTrace(query, userLocation);

    try {
        // Step 1: Parse the query using LLM
        const parseStart = Date.now();
        const parseResult = await parseQuery(query);
        trace.parsing = {
            prompt: query,
            raw_response: parseResult.raw_response,
            parsed: parseResult.parsed,
            latency_ms: parseResult.latency_ms,
            model: parseResult.model,
        };

        const parsed = parseResult.parsed;

        // Step 2: Determine search center (geocode or user location)
        let searchCenter: Coords | null = null;
        const geocodeStart = Date.now();

        if (parsed.location_name) {
            // Geocode the named location
            const geoResult = await geocode(parsed.location_name);
            if (geoResult) {
                searchCenter = { lat: geoResult.lat, lng: geoResult.lng };
                trace.geocoding = {
                    input: parsed.location_name,
                    output: searchCenter,
                    source: geoResult.source,
                    latency_ms: Date.now() - geocodeStart,
                };
            } else {
                trace.geocoding = {
                    input: parsed.location_name,
                    output: null,
                    source: 'skipped',
                    latency_ms: Date.now() - geocodeStart,
                    error: 'Geocoding returned no results',
                };
                addTraceError(trace, 'geocoding', `Could not geocode "${parsed.location_name}"`);
            }
        } else if (parsed.use_current_location && userLocation) {
            // Use user's current location
            searchCenter = userLocation;
            trace.geocoding = {
                input: 'user_location',
                output: searchCenter,
                source: 'user_location',
                latency_ms: 0,
            };
        } else {
            // No location filtering
            trace.geocoding = {
                input: null,
                output: null,
                source: 'skipped',
                latency_ms: 0,
            };
        }

        // Step 3: Query database with filters
        const dbStart = Date.now();
        let queryBuilder = supabase.from('stalls').select('*').eq('status', 'open');

        // Apply cuisine filter if parsed
        if (parsed.cuisine) {
            queryBuilder = queryBuilder.ilike('cuisine', `%${parsed.cuisine}%`);
        }

        // Apply price filter if parsed
        if (parsed.price) {
            let affordabilityValues: string[] = [];
            switch (parsed.price) {
                case 'cheap':
                    affordabilityValues = ['Affordable (< S$10)'];
                    break;
                case 'moderate':
                    affordabilityValues = ['Mid-Range (S$10–S$20)'];
                    break;
                case 'expensive':
                    affordabilityValues = ['Premium (> S$20)'];
                    break;
            }
            if (affordabilityValues.length > 0) {
                queryBuilder = queryBuilder.in('affordability', affordabilityValues);
            }
        }

        const { data: dbResults, error: dbError } = await queryBuilder;

        if (dbError) {
            addTraceError(trace, 'database', dbError.message);
            throw dbError;
        }

        trace.database = {
            filters: {
                cuisine: parsed.cuisine,
                price: parsed.price,
                status: 'open',
            },
            row_count: dbResults?.length || 0,
            latency_ms: Date.now() - dbStart,
        };

        // Step 4: Distance filtering (if search center available)
        let candidates: AgentStall[] = (dbResults || []).map(stall => ({
            ...stall,
            recommended_dishes: stall.recommended_dishes || [],
        }));

        trace.distance_filter.before_count = candidates.length;
        trace.distance_filter.radius_km = AGENT_CONFIG.DEFAULT_RADIUS_KM;

        if (searchCenter) {
            trace.distance_filter.center = searchCenter;

            // Calculate distance and filter
            candidates = candidates
                .map(stall => ({
                    ...stall,
                    distance: calculateDistance(
                        searchCenter!.lat,
                        searchCenter!.lng,
                        stall.latitude,
                        stall.longitude
                    ),
                }))
                .filter(stall => stall.distance! <= AGENT_CONFIG.DEFAULT_RADIUS_KM)
                .sort((a, b) => a.distance! - b.distance!);
        }

        trace.distance_filter.after_count = candidates.length;

        // Step 5: LLM Ranking
        if (candidates.length === 0) {
            trace.ranking = {
                food_query: parsed.food_query,
                candidate_count: 0,
                prompt: '',
                raw_response: '',
                ranked_ids: [],
                reasoning: 'No candidates to rank',
                latency_ms: 0,
                model: AGENT_CONFIG.LLM_MODEL,
            };
        } else {
            const rankResult = await rankWithLLM(parsed.food_query, candidates);
            trace.ranking = {
                food_query: parsed.food_query,
                candidate_count: candidates.length,
                prompt: '', // Could store the full prompt if needed
                raw_response: rankResult.raw_response,
                ranked_ids: rankResult.ranking.ranked_ids,
                reasoning: rankResult.ranking.reasoning,
                latency_ms: rankResult.latency_ms,
                model: rankResult.model,
            };
        }

        // Reorder candidates based on ranking
        const rankedIds = trace.ranking.ranked_ids;
        const idToCandidate = new Map(candidates.map(c => [c.place_id, c]));
        const rankedCandidates = rankedIds
            .map(id => idToCandidate.get(id))
            .filter((c): c is AgentStall => c !== undefined);

        // Finalize trace
        trace.result_count = rankedCandidates.length;
        finalizeTrace(trace);

        // Log trace
        logTraceToConsole(trace);
        logTraceToSupabase(trace).catch(err => console.warn('Failed to log trace:', err));

        // Format results
        const results = rankedCandidates.slice(0, AGENT_CONFIG.TOP_N_RESULTS).map(stall => ({
            place_id: stall.place_id,
            name: stall.name,
            distance: stall.distance ?? null,
            cuisine: stall.cuisine,
            affordability: stall.affordability,
            recommended_dishes: stall.recommended_dishes,
            source: stall.source,
            source_url: stall.source_url,
            date_published: stall.date_published,
            review_summary: stall.review_summary,
            location: stall.location,
        }));

        return {
            results,
            parsed: trace.parsing.parsed,
            search_center: searchCenter,
            reasoning: trace.ranking.reasoning,
            trace: debug ? trace : undefined,
            summary: createTraceSummary(trace),
        };
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        addTraceError(trace, 'general', errorMessage);
        finalizeTrace(trace);
        logTraceToConsole(trace);

        throw error;
    }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { mode, query, latitude, longitude, cuisine, proximity, affordability, comments, compare, useAgent, debug } = req.body;

    //if (!latitude || !longitude) {
    //    return res.status(400).json({ error: 'Location coordinates are required' });
    //}

    try {
        // Agent-powered search for free mode
        if (mode === 'free' && useAgent) {
            const userLocation = (latitude !== null && longitude !== null)
                ? { lat: latitude, lng: longitude }
                : null;

            const agentResult = await performAgentSearch(query, userLocation, debug);
            return res.status(200).json(agentResult);
        }

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
                        similarity: semanticScores.get(stall.place_id) || 0,
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

            // Build rerank query from filters
            const buildRerankQuery = (): string => {
                const parts: string[] = [];
                if (cuisine) parts.push(cuisine + ' food');
                if (affordability) {
                    const priceDesc = affordability === '$' ? 'cheap affordable' :
                                     affordability === '$$' ? 'mid-range' : 'premium';
                    parts.push(priceDesc);
                }
                if (comments && comments.trim()) parts.push(comments.trim());
                return parts.length > 0 ? parts.join(' ') : 'good food stall';
            };

            // Standard results (sorted by adjusted distance)
            const standardResults = filteredStalls.slice(0, 10).map(stall => ({
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
                location: stall.location,
                similarity: stall.similarity || null
            }));

            if (compare && filteredStalls.length > 0) {
                // Rerank using Cohere
                const rerankQuery = buildRerankQuery();
                const rerankedStalls = await rerankResults(rerankQuery, filteredStalls);

                const rerankedResults = rerankedStalls.slice(0, 10).map(stall => ({
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
                    location: stall.location,
                    cohereScore: stall.cohereScore
                }));

                return res.status(200).json({
                    standard: standardResults,
                    reranked: rerankedResults
                });
            }

            return res.status(200).json(standardResults);
        }
    } catch (error) {
        console.error('Search error:', error);
        return res.status(500).json({ error: 'An error occurred during search' });
    }
}