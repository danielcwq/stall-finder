/**
 * Agent Search Module
 *
 * LLM-powered search that understands natural language queries
 * with location awareness and intelligent ranking.
 *
 * @example
 * import { parseQuery, geocode, rankWithLLM } from '@/utils/agent';
 */

// Types
export * from './types';

// Core functions
export { geocode, isGeocodingConfigured, getGeocodingStatus } from './geocode';
export { parseQuery } from './parseQuery';
export { rankWithLLM } from './rankWithLLM';

// Fallback data
export { getFallbackLocation, FALLBACK_LOCATIONS } from './fallbackLocations';

// Tracing
export {
  generateTraceId,
  createEmptyTrace,
  addTraceError,
  finalizeTrace,
  createTraceSummary,
  logTraceToSupabase,
  logTraceToConsole,
} from './trace';
