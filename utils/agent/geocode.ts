/**
 * Geocoding Utility
 *
 * Converts Singapore place names to coordinates using OneMap API.
 *
 * @see https://www.onemap.gov.sg/apidocs/
 *
 * Required environment variable:
 * - ONEMAP_API_TOKEN: Access token from OneMap authentication service
 */

import { Coords, GeocodingResult } from './types';
import { getFallbackLocation } from './fallbackLocations';

// ============================================
// OneMap API Types
// ============================================

interface OneMapSearchResult {
  SEARCHVAL: string;
  BLK_NO: string;
  ROAD_NAME: string;
  BUILDING: string;
  ADDRESS: string;
  POSTAL: string;
  X: string;
  Y: string;
  LATITUDE: string;
  LONGITUDE: string;
  LONGTITUDE: string; // Note: OneMap has a typo in their API
}

interface OneMapResponse {
  found: number;
  totalNumPages: number;
  pageNum: number;
  results: OneMapSearchResult[];
}

// ============================================
// OneMap API Geocoding
// ============================================

/**
 * Geocode a location using Singapore's OneMap API.
 * Falls back to hardcoded locations if OneMap is unavailable or returns no results.
 *
 * @param placeName - Place name, road, building, or postal code
 * @returns Coordinates and address info, or null if not found
 *
 * @example
 * const result = await geocode("Bugis");
 * // { lat: 1.3008, lng: 103.8558, source: 'onemap', input: 'Bugis', address: '...' }
 */
export async function geocode(placeName: string): Promise<GeocodingResult | null> {
  const token = process.env.ONEMAP_API_TOKEN;

  // If no token configured, use fallback immediately
  if (!token) {
    console.warn('ONEMAP_API_TOKEN not set, using fallback locations');
    return geocodeWithFallback(placeName);
  }

  try {
    const url = new URL('https://www.onemap.gov.sg/api/common/elastic/search');
    url.searchParams.set('searchVal', placeName);
    url.searchParams.set('returnGeom', 'Y');
    url.searchParams.set('getAddrDetails', 'Y');
    url.searchParams.set('pageNum', '1');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Authorization': token,
      },
    });

    // Handle error responses - fall back to hardcoded locations
    if (response.status === 400) {
      console.warn(`OneMap API bad request for: "${placeName}", trying fallback`);
      return geocodeWithFallback(placeName);
    }

    if (response.status === 403) {
      console.error('OneMap API access forbidden - check your token, trying fallback');
      return geocodeWithFallback(placeName);
    }

    if (response.status === 429) {
      console.warn('OneMap API rate limit exceeded, trying fallback');
      return geocodeWithFallback(placeName);
    }

    if (!response.ok) {
      console.warn(`OneMap API error: ${response.status}, trying fallback`);
      return geocodeWithFallback(placeName);
    }

    const data: OneMapResponse = await response.json();

    if (data.found === 0 || !data.results || data.results.length === 0) {
      console.log(`OneMap: No results for "${placeName}", trying fallback`);
      return geocodeWithFallback(placeName);
    }

    // Return the first (most relevant) result
    const result = data.results[0];
    return {
      lat: parseFloat(result.LATITUDE),
      lng: parseFloat(result.LONGITUDE),
      source: 'onemap',
      input: placeName,
      address: result.ADDRESS,
    };
  } catch (error) {
    console.error('OneMap geocoding error:', error);
    return geocodeWithFallback(placeName);
  }
}

/**
 * Attempt to geocode using fallback locations.
 */
function geocodeWithFallback(placeName: string): GeocodingResult | null {
  const coords = getFallbackLocation(placeName);

  if (coords) {
    console.log(`Using fallback location for "${placeName}"`);
    return {
      lat: coords.lat,
      lng: coords.lng,
      source: 'fallback',
      input: placeName,
      address: undefined, // No address available from fallback
    };
  }

  console.log(`No fallback location found for "${placeName}"`);
  return null;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if geocoding is properly configured.
 * Use this to show appropriate UI messages.
 */
export function isGeocodingConfigured(): boolean {
  return !!process.env.ONEMAP_API_TOKEN;
}

/**
 * Get geocoding configuration status for debugging.
 */
export function getGeocodingStatus(): { configured: boolean; message: string } {
  if (process.env.ONEMAP_API_TOKEN) {
    return {
      configured: true,
      message: 'OneMap API token is configured',
    };
  }

  return {
    configured: false,
    message: 'ONEMAP_API_TOKEN environment variable is not set. Geocoding will not work.',
  };
}
