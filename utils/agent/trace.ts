/**
 * Trace Logging Utility
 *
 * Provides observability for the agent search flow.
 * Captures timing, inputs/outputs, and errors at each step.
 */

import { createClient } from '@supabase/supabase-js';
import { SearchTrace, TraceSummary, Coords } from './types';

// Initialize Supabase client for trace logging
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Generate a unique trace ID.
 */
export function generateTraceId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `trace_${timestamp}_${random}`;
}

/**
 * Create an empty trace object to be populated during search.
 */
export function createEmptyTrace(
  rawQuery: string,
  userLocation: Coords | null
): SearchTrace {
  return {
    trace_id: generateTraceId(),
    timestamp: new Date().toISOString(),
    raw_query: rawQuery,
    user_location: userLocation,
    parsing: {
      prompt: '',
      raw_response: '',
      parsed: null,
      latency_ms: 0,
      model: '',
    },
    geocoding: {
      input: null,
      output: null,
      source: 'skipped',
      latency_ms: 0,
    },
    database: {
      filters: {},
      row_count: 0,
      latency_ms: 0,
    },
    distance_filter: {
      center: null,
      radius_km: 0,
      before_count: 0,
      after_count: 0,
    },
    ranking: {
      food_query: '',
      candidate_count: 0,
      prompt: '',
      raw_response: '',
      ranked_ids: [],
      reasoning: null,
      latency_ms: 0,
      model: '',
    },
    result_count: 0,
    total_latency_ms: 0,
    errors: [],
  };
}

/**
 * Add an error to the trace.
 */
export function addTraceError(
  trace: SearchTrace,
  step: string,
  message: string
): void {
  trace.errors.push({ step, message });
}

/**
 * Calculate total latency and finalize the trace.
 */
export function finalizeTrace(trace: SearchTrace): void {
  trace.total_latency_ms =
    trace.parsing.latency_ms +
    trace.geocoding.latency_ms +
    trace.database.latency_ms +
    trace.ranking.latency_ms;
}

/**
 * Create a summary of the trace for non-debug API responses.
 */
export function createTraceSummary(trace: SearchTrace): TraceSummary {
  return {
    trace_id: trace.trace_id,
    timings: {
      parsing_ms: trace.parsing.latency_ms,
      geocoding_ms: trace.geocoding.latency_ms,
      database_ms: trace.database.latency_ms,
      distance_filter_ms: 0, // Distance filtering is in-memory, negligible
      ranking_ms: trace.ranking.latency_ms,
      total_ms: trace.total_latency_ms,
    },
    counts: {
      db_results: trace.database.row_count,
      after_distance_filter: trace.distance_filter.after_count,
      final_results: trace.result_count,
    },
  };
}

/**
 * Log the trace to Supabase for debugging and analytics.
 *
 * Note: Requires the `agent_search_traces` table to exist in Supabase.
 * If the table doesn't exist, this will silently fail and log to console.
 */
export async function logTraceToSupabase(trace: SearchTrace): Promise<void> {
  try {
    const { error } = await supabase.from('agent_search_traces').insert({
      trace_id: trace.trace_id,
      timestamp: trace.timestamp,
      raw_query: trace.raw_query,
      user_location: trace.user_location,
      parsed_query: trace.parsing.parsed,
      geocoding_source: trace.geocoding.source,
      search_center: trace.geocoding.output,
      db_filters: trace.database.filters,
      db_row_count: trace.database.row_count,
      distance_radius_km: trace.distance_filter.radius_km,
      candidates_before_distance: trace.distance_filter.before_count,
      candidates_after_distance: trace.distance_filter.after_count,
      ranked_ids: trace.ranking.ranked_ids,
      ranking_reasoning: trace.ranking.reasoning,
      result_count: trace.result_count,
      parsing_latency_ms: trace.parsing.latency_ms,
      geocoding_latency_ms: trace.geocoding.latency_ms,
      database_latency_ms: trace.database.latency_ms,
      ranking_latency_ms: trace.ranking.latency_ms,
      total_latency_ms: trace.total_latency_ms,
      errors: trace.errors.length > 0 ? trace.errors : null,
      parsing_model: trace.parsing.model,
      ranking_model: trace.ranking.model,
    });

    if (error) {
      // Table might not exist yet - just log to console
      console.warn('Failed to log trace to Supabase:', error.message || error.code || JSON.stringify(error));
    }
  } catch (error) {
    console.warn('Error logging trace:', error);
  }
}

/**
 * Log trace to console for local development.
 */
export function logTraceToConsole(trace: SearchTrace): void {
  console.log('\n========== AGENT SEARCH TRACE ==========');
  console.log(`Trace ID: ${trace.trace_id}`);
  console.log(`Query: "${trace.raw_query}"`);
  console.log(`\n--- Parsing ---`);
  console.log(`  Model: ${trace.parsing.model}`);
  console.log(`  Latency: ${trace.parsing.latency_ms}ms`);
  console.log(`  Parsed:`, trace.parsing.parsed);
  console.log(`\n--- Geocoding ---`);
  console.log(`  Source: ${trace.geocoding.source}`);
  console.log(`  Input: ${trace.geocoding.input}`);
  console.log(`  Output:`, trace.geocoding.output);
  console.log(`  Latency: ${trace.geocoding.latency_ms}ms`);
  console.log(`\n--- Database ---`);
  console.log(`  Filters:`, trace.database.filters);
  console.log(`  Row count: ${trace.database.row_count}`);
  console.log(`  Latency: ${trace.database.latency_ms}ms`);
  console.log(`\n--- Distance Filter ---`);
  console.log(`  Center:`, trace.distance_filter.center);
  console.log(`  Radius: ${trace.distance_filter.radius_km}km`);
  console.log(`  Before: ${trace.distance_filter.before_count}, After: ${trace.distance_filter.after_count}`);
  console.log(`\n--- Ranking ---`);
  console.log(`  Model: ${trace.ranking.model}`);
  console.log(`  Candidates: ${trace.ranking.candidate_count}`);
  console.log(`  Latency: ${trace.ranking.latency_ms}ms`);
  console.log(`  Reasoning: ${trace.ranking.reasoning}`);
  console.log(`\n--- Results ---`);
  console.log(`  Final count: ${trace.result_count}`);
  console.log(`  Total latency: ${trace.total_latency_ms}ms`);
  if (trace.errors.length > 0) {
    console.log(`\n--- Errors ---`);
    trace.errors.forEach(e => console.log(`  [${e.step}] ${e.message}`));
  }
  console.log('==========================================\n');
}
