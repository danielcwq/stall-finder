/**
 * Query Parser
 *
 * Uses Cohere LLM to extract structured parameters from natural language queries.
 */

import { CohereClient } from 'cohere-ai';
import { ParsedQuery, AGENT_CONFIG } from './types';

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

/**
 * System prompt for query parsing.
 * Instructs the LLM to extract structured search parameters.
 */
const PARSE_SYSTEM_PROMPT = `You are a food search query parser for Singapore hawker food.

Extract structured parameters from the user's natural language query.

Return a JSON object with these fields:
- food_query: The core food/dish being searched for (required, string)
- location_name: Named location if mentioned, e.g., "Bugis", "Orchard" (string or null)
- use_current_location: true if user said "near me", "nearby", "around here", etc. (boolean)
- cuisine: Cuisine type if mentioned, e.g., "Chinese", "Malay", "Indian" (string or null)
- price: Price preference - "cheap", "moderate", or "expensive" (string or null)
- exclusions: Array of things to exclude, e.g., ["no pork", "not too oily"] (string array)

IMPORTANT RULES:
1. If no specific location is mentioned, set location_name to null
2. "Near me", "nearby", "around here", "close by" → use_current_location: true
3. For price, map words like "affordable", "budget" → "cheap"; "premium", "high-end" → "expensive"
4. The food_query should capture the essence of what food the user wants
5. Only include exclusions explicitly stated by the user

Examples:

Query: "spicy laksa near Bugis"
{"food_query": "spicy laksa", "location_name": "Bugis", "use_current_location": false, "cuisine": null, "price": null, "exclusions": []}

Query: "cheap chicken rice near me"
{"food_query": "chicken rice", "location_name": null, "use_current_location": true, "cuisine": null, "price": "cheap", "exclusions": []}

Query: "best hokkien mee"
{"food_query": "hokkien mee", "location_name": null, "use_current_location": false, "cuisine": null, "price": null, "exclusions": []}

Query: "halal nasi lemak at Geylang"
{"food_query": "halal nasi lemak", "location_name": "Geylang", "use_current_location": false, "cuisine": "Malay", "price": null, "exclusions": []}

Query: "not too oily char kway teow nearby"
{"food_query": "char kway teow", "location_name": null, "use_current_location": true, "cuisine": null, "price": null, "exclusions": ["not too oily"]}

Respond ONLY with valid JSON, no explanation.`;

export interface ParseQueryResult {
  parsed: ParsedQuery;
  raw_response: string;
  latency_ms: number;
  model: string;
}

/**
 * Parse a natural language food query into structured parameters.
 *
 * @param query - The user's natural language search query
 * @returns Parsed query parameters with timing info
 * @throws Error if parsing fails
 *
 * @example
 * const result = await parseQuery("spicy laksa near Bugis");
 * // result.parsed = {
 * //   food_query: "spicy laksa",
 * //   location_name: "Bugis",
 * //   use_current_location: false,
 * //   cuisine: null,
 * //   price: null,
 * //   exclusions: []
 * // }
 */
export async function parseQuery(query: string): Promise<ParseQueryResult> {
  const startTime = Date.now();
  const model = AGENT_CONFIG.LLM_MODEL;

  try {
    const response = await cohere.chat({
      model,
      message: query,
      preamble: PARSE_SYSTEM_PROMPT,
      temperature: 0.1, // Low temperature for consistent parsing
    });

    const raw_response = response.text;
    const latency_ms = Date.now() - startTime;

    // Parse the JSON response
    const parsed = parseJsonResponse(raw_response);

    return {
      parsed,
      raw_response,
      latency_ms,
      model,
    };
  } catch (error) {
    console.error('Query parsing error:', error);
    throw new Error(`Failed to parse query: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse and validate the JSON response from the LLM.
 */
function parseJsonResponse(response: string): ParsedQuery {
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

    // Validate and normalize the parsed object
    return {
      food_query: String(parsed.food_query || '').trim(),
      location_name: parsed.location_name ? String(parsed.location_name).trim() : null,
      use_current_location: Boolean(parsed.use_current_location),
      cuisine: parsed.cuisine ? String(parsed.cuisine).trim() : null,
      price: normalizePrice(parsed.price),
      exclusions: Array.isArray(parsed.exclusions)
        ? parsed.exclusions.map((e: unknown) => String(e).trim())
        : [],
    };
  } catch (error) {
    console.error('Failed to parse JSON response:', jsonStr);
    throw new Error(`Invalid JSON response from LLM: ${jsonStr.slice(0, 100)}`);
  }
}

/**
 * Normalize price value to expected enum values.
 */
function normalizePrice(price: unknown): 'cheap' | 'moderate' | 'expensive' | null {
  if (!price) return null;

  const normalized = String(price).toLowerCase().trim();

  if (['cheap', 'budget', 'affordable', 'low'].includes(normalized)) {
    return 'cheap';
  }
  if (['moderate', 'medium', 'mid'].includes(normalized)) {
    return 'moderate';
  }
  if (['expensive', 'premium', 'high', 'high-end'].includes(normalized)) {
    return 'expensive';
  }

  return null;
}
