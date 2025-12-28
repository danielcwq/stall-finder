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

INSTRUCTIONS:
1. Consider how well each stall matches the food query
2. Prefer stalls with relevant dishes or specialties
3. Consider distance (closer is generally better, but not if irrelevant)
4. Consider reviews mentioning the searched food
5. Return the stall numbers in order of relevance, most relevant first

Respond with ONLY a JSON object in this format:
{
  "ranked_ids": [3, 1, 5, 2, 4],
  "reasoning": "Brief explanation of top picks"
}

Where ranked_ids contains the stall numbers (1-indexed) in order of relevance.`;
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
