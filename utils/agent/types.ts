/**
 * Agent Search Type Definitions
 *
 * These types support the LLM-powered search flow:
 * Query Parsing → Geocoding → DB Filter → LLM Ranking
 */

// ============================================
// Input/Output Types
// ============================================

/**
 * Structured query extracted from natural language input
 */
export interface ParsedQuery {
  /** Core food/dish being searched for (e.g., "spicy laksa") */
  food_query: string;

  /** Named location if mentioned (e.g., "Bugis", "Orchard") */
  location_name: string | null;

  /** True if user said "near me", "nearby", "around here" */
  use_current_location: boolean;

  /** Cuisine type if mentioned (e.g., "Chinese", "Malay") */
  cuisine: string | null;

  /** Price preference */
  price: 'cheap' | 'moderate' | 'expensive' | null;

  /** Things to exclude (e.g., ["not too oily", "no pork"]) */
  exclusions: string[];
}

/**
 * Result from geocoding a location name
 */
export interface GeocodingResult {
  lat: number;
  lng: number;
  /** 'onemap' for API result, 'fallback' for hardcoded locations */
  source: 'onemap' | 'fallback';
  /** Original input that was geocoded */
  input: string;
  /** Full address returned by OneMap (if available) */
  address?: string;
}

/**
 * Coordinates for user or search location
 */
export interface Coords {
  lat: number;
  lng: number;
}

/**
 * Result from LLM ranking
 */
export interface RankingResult {
  /** Ordered list of place_ids, most relevant first */
  ranked_ids: string[];

  /** Optional explanation of why top items were ranked */
  reasoning: string | null;
}

/**
 * Final response from agent search
 */
export interface AgentSearchResponse {
  /** Ranked stall results */
  results: Stall[];

  /** How the query was parsed */
  parsed: ParsedQuery;

  /** Center point used for distance filtering (if any) */
  search_center: Coords | null;

  /** Why these results were chosen */
  reasoning?: string;

  /** Full trace data (only in debug mode) */
  trace?: SearchTrace;
}

// ============================================
// Stall Type (mirrors database schema)
// ============================================

/**
 * Stall record from Supabase database
 * Matches the `stalls` table schema exactly
 */
export interface Stall {
  /** Primary key (text) */
  place_id: string;

  /** Category of food stall (text) */
  category: string;

  /** Name of the stall (text) */
  name: string;

  /** Address/location description (text) */
  location: string;

  /** Cuisine type e.g., "Chinese", "Malay", "Indian" (text) */
  cuisine: string;

  /** Price range e.g., "Affordable (< S$10)" (text) */
  affordability: string;

  /** Operating hours if available (text, nullable) */
  operating_hours: string | null;

  /** Summary of reviews from food blogs (text) */
  review_summary: string;

  /** Array of recommended dishes (_text / text[]) */
  recommended_dishes: string[];

  /** Source food blog(s) (text) */
  source: string;

  /** URL(s) to source articles (text) */
  source_url: string;

  /** When the review was published (timestamp, nullable) */
  date_published: string | null;

  /** Latitude coordinate (float8) */
  latitude: number;

  /** Longitude coordinate (float8) */
  longitude: number;

  /** Status enum: open, closed, etc. (stall_status) */
  status: string;

  // Fields stored in DB but not returned to client:
  // embedding: vector
  // embedded_text: text
  // embedding_768: vector

  // ---- Computed fields (added at runtime) ----

  /** Distance from search center in km */
  distance?: number;
}

// ============================================
// Trace Types (Observability)
// ============================================

/**
 * Full trace of an agent search for debugging/logging
 */
export interface SearchTrace {
  /** Unique identifier for this search */
  trace_id: string;

  /** When the search started */
  timestamp: string;

  // ---- Input ----
  raw_query: string;
  user_location: Coords | null;

  // ---- Step 1: Parsing ----
  parsing: {
    prompt: string;
    raw_response: string;
    parsed: ParsedQuery | null;
    latency_ms: number;
    model: string;
    error?: string;
  };

  // ---- Step 2: Geocoding ----
  geocoding: {
    input: string | null;
    output: Coords | null;
    source: 'onemap' | 'fallback' | 'user_location' | 'skipped';
    latency_ms: number;
    error?: string;
  };

  // ---- Step 3: Database ----
  database: {
    filters: Record<string, unknown>;
    row_count: number;
    latency_ms: number;
    error?: string;
  };

  // ---- Step 4: Distance Filter ----
  distance_filter: {
    center: Coords | null;
    radius_km: number;
    before_count: number;
    after_count: number;
  };

  // ---- Step 5: LLM Ranking ----
  ranking: {
    food_query: string;
    candidate_count: number;
    prompt: string;
    raw_response: string;
    ranked_ids: string[];
    reasoning: string | null;
    latency_ms: number;
    model: string;
    error?: string;
  };

  // ---- Output ----
  result_count: number;
  total_latency_ms: number;

  // ---- Errors ----
  errors: Array<{ step: string; message: string }>;
}

/**
 * Simplified trace for API response (non-debug mode)
 */
export interface TraceSummary {
  trace_id: string;
  timings: {
    parsing_ms: number;
    geocoding_ms: number;
    database_ms: number;
    distance_filter_ms: number;
    ranking_ms: number;
    total_ms: number;
  };
  counts: {
    db_results: number;
    after_distance_filter: number;
    final_results: number;
  };
}

// ============================================
// Constants
// ============================================

export const AGENT_CONFIG = {
  /** Default search radius in kilometers */
  DEFAULT_RADIUS_KM: 2,

  /** Maximum candidates to send to LLM for ranking */
  MAX_RANKING_CANDIDATES: 50,

  /** Number of results to return */
  TOP_N_RESULTS: 10,

  /** Cohere model for parsing and ranking */
  LLM_MODEL: 'command-r',
} as const;
