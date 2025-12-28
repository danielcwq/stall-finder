/**
 * LLM Ranking
 *
 * Uses Cohere LLM to rank food stall candidates by relevance to the user's query.
 * This replaces the need for embeddings + reranker by having the LLM directly
 * evaluate and rank candidates.
 */

import { CohereClient } from 'cohere-ai';
import { Stall, RankingResult, AGENT_CONFIG } from './types';

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

/**
 * Build the ranking prompt for the LLM.
 */
function buildRankingPrompt(foodQuery: string, candidates: Stall[]): string {
  const candidateDescriptions = candidates.map((stall, index) => {
    const dishes = stall.recommended_dishes?.join(', ') || 'Not specified';
    const distance = stall.distance !== undefined ? `${stall.distance.toFixed(2)}km away` : 'Distance unknown';

    return `[${index + 1}] ${stall.name}
   Category: ${stall.category}
   Cuisine: ${stall.cuisine}
   Location: ${stall.location}
   Distance: ${distance}
   Price: ${stall.affordability}
   Recommended Dishes: ${dishes}
   Review: ${stall.review_summary?.slice(0, 200) || 'No review'}`;
  }).join('\n\n');

  return `User is searching for: "${foodQuery}"

Here are the candidate food stalls. Rank them by relevance to the user's search.

${candidateDescriptions}

INSTRUCTIONS (in order of priority):
1. **NAME MATCH IS HIGHEST PRIORITY**: If the search contains a restaurant/stall name (e.g., "chindamani", "tian tian", "hill street"), stalls with matching names MUST be ranked first
2. Prefer stalls with relevant dishes or specialties matching the food query
3. Consider reviews mentioning the searched food
4. Consider distance (closer is generally better)
5. Return at least 10 stall numbers if available

Respond with ONLY a JSON object in this format:
{
  "ranked_ids": [3, 1, 5, 2, 4, 7, 8, 9, 10, 6],
  "reasoning": "Brief explanation of top picks"
}

Where ranked_ids contains the stall numbers (1-indexed) in order of relevance. Include at least 10 results.`;
}

/**
 * Build a compact text representation of a stall for the LLM.
 */
function buildStallSummary(stall: Stall): string {
  const parts = [
    stall.name,
    stall.category,
    stall.cuisine,
    stall.affordability,
  ];

  if (stall.recommended_dishes?.length) {
    parts.push(`Dishes: ${stall.recommended_dishes.join(', ')}`);
  }

  if (stall.review_summary) {
    parts.push(`Review: ${stall.review_summary.slice(0, 150)}`);
  }

  return parts.join(' | ');
}

export interface RankWithLLMResult {
  ranking: RankingResult;
  raw_response: string;
  latency_ms: number;
  model: string;
}

/**
 * Find candidates with names matching the query keywords using simple substring matching.
 * Returns indices of matching candidates, sorted by match quality.
 */
function findNameMatches(foodQuery: string, candidates: Stall[]): number[] {
  const queryWords = foodQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const matches: { index: number; score: number }[] = [];

  candidates.forEach((stall, index) => {
    const stallName = stall.name.toLowerCase();
    let score = 0;

    // Check each query word against the stall name
    for (const word of queryWords) {
      if (stallName.includes(word)) {
        score += word.length; // Longer matches = higher score
      }
    }

    // Bonus for exact phrase match
    if (stallName.includes(foodQuery.toLowerCase())) {
      score += 100;
    }

    if (score > 0) {
      matches.push({ index, score });
    }
  });

  // Sort by score descending
  return matches.sort((a, b) => b.score - a.score).map(m => m.index);
}

/**
 * Rank food stall candidates using Cohere LLM.
 *
 * @param foodQuery - The food the user is searching for
 * @param candidates - Array of stall candidates to rank
 * @returns Ranked stall IDs with reasoning
 *
 * @example
 * const result = await rankWithLLM("spicy laksa", candidates);
 * // result.ranking.ranked_ids = ["place_id_1", "place_id_2", ...]
 */
export async function rankWithLLM(
  foodQuery: string,
  candidates: Stall[]
): Promise<RankWithLLMResult> {
  const startTime = Date.now();
  const model = AGENT_CONFIG.LLM_MODEL;

  if (candidates.length === 0) {
    return {
      ranking: { ranked_ids: [], reasoning: 'No candidates to rank' },
      raw_response: '',
      latency_ms: 0,
      model,
    };
  }

  // Pre-filter: Find name matches first using simple substring matching
  const nameMatchIndices = findNameMatches(foodQuery, candidates);

  // If we have name matches, prioritize them at the front
  if (nameMatchIndices.length > 0) {
    console.log(`[Substring Match] Found ${nameMatchIndices.length} name matches for "${foodQuery}":`,
      nameMatchIndices.slice(0, 5).map(i => candidates[i].name));

    // Put name matches at the front, then fill with others
    const nameMatchCandidates = nameMatchIndices.map(i => candidates[i]);
    const otherCandidates = candidates.filter((_, i) => !nameMatchIndices.includes(i));
    candidates = [...nameMatchCandidates, ...otherCandidates];
  }

  // Limit candidates to prevent token overflow
  const limitedCandidates = candidates.slice(0, AGENT_CONFIG.MAX_RANKING_CANDIDATES);

  try {
    const prompt = buildRankingPrompt(foodQuery, limitedCandidates);

    const response = await cohere.chat({
      model,
      message: prompt,
      temperature: 0.1, // Low temperature for consistent ranking
    });

    const raw_response = response.text;
    const latency_ms = Date.now() - startTime;

    // Parse the ranking response
    const ranking = parseRankingResponse(raw_response, limitedCandidates);

    return {
      ranking,
      raw_response,
      latency_ms,
      model,
    };
  } catch (error) {
    console.error('LLM ranking error:', error);
    // Fallback: return candidates in original order
    return {
      ranking: {
        ranked_ids: candidates.slice(0, AGENT_CONFIG.TOP_N_RESULTS).map(s => s.place_id),
        reasoning: 'Fallback to original order due to ranking error',
      },
      raw_response: '',
      latency_ms: Date.now() - startTime,
      model,
    };
  }
}

/**
 * Parse the LLM's ranking response.
 */
function parseRankingResponse(response: string, candidates: Stall[]): RankingResult {
  // Clean up the response - remove markdown code blocks if present
  let jsonStr = response.trim();

  if (jsonStr.startsWith('```json')) {
    jsonStr = jsonStr.slice(7);
  } else if (jsonStr.startsWith('```')) {
    jsonStr = jsonStr.slice(3);
  }

  if (jsonStr.endsWith('```')) {
    jsonStr = jsonStr.slice(0, -3);
  }

  jsonStr = jsonStr.trim();

  try {
    const parsed = JSON.parse(jsonStr);

    // Convert 1-indexed positions to place_ids
    const rankedIds: string[] = [];

    if (Array.isArray(parsed.ranked_ids)) {
      for (const position of parsed.ranked_ids) {
        const index = Number(position) - 1; // Convert to 0-indexed
        if (index >= 0 && index < candidates.length) {
          rankedIds.push(candidates[index].place_id);
        }
      }
    }

    // If we didn't get valid rankings, fall back to first N candidates
    if (rankedIds.length === 0) {
      return {
        ranked_ids: candidates.slice(0, AGENT_CONFIG.TOP_N_RESULTS).map(s => s.place_id),
        reasoning: 'Fallback to original order - could not parse ranking',
      };
    }

    return {
      ranked_ids: rankedIds.slice(0, AGENT_CONFIG.TOP_N_RESULTS),
      reasoning: parsed.reasoning || null,
    };
  } catch (error) {
    console.error('Failed to parse ranking response:', jsonStr);
    // Fallback to original order
    return {
      ranked_ids: candidates.slice(0, AGENT_CONFIG.TOP_N_RESULTS).map(s => s.place_id),
      reasoning: 'Fallback to original order - JSON parse error',
    };
  }
}
