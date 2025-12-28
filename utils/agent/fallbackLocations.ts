/**
 * Fallback Location Coordinates
 *
 * Used when OneMap API is unavailable or returns no results.
 * Contains coordinates for common Singapore locations.
 */

import { Coords } from './types';

/**
 * Known Singapore locations with their coordinates.
 * Keys are lowercase for case-insensitive matching.
 */
export const FALLBACK_LOCATIONS: Record<string, Coords> = {
  // MRT Stations / Major Areas
  'bugis': { lat: 1.3008, lng: 103.8558 },
  'orchard': { lat: 1.3041, lng: 103.8318 },
  'chinatown': { lat: 1.2834, lng: 103.8443 },
  'little india': { lat: 1.3066, lng: 103.8518 },
  'clarke quay': { lat: 1.2884, lng: 103.8464 },
  'marina bay': { lat: 1.2794, lng: 103.8543 },
  'raffles place': { lat: 1.2830, lng: 103.8513 },
  'tanjong pagar': { lat: 1.2764, lng: 103.8456 },
  'tiong bahru': { lat: 1.2867, lng: 103.8277 },
  'geylang': { lat: 1.3119, lng: 103.8868 },
  'katong': { lat: 1.3048, lng: 103.9052 },
  'joo chiat': { lat: 1.3130, lng: 103.9025 },
  'east coast': { lat: 1.3016, lng: 103.9123 },
  'bedok': { lat: 1.3241, lng: 103.9304 },
  'tampines': { lat: 1.3536, lng: 103.9456 },
  'pasir ris': { lat: 1.3730, lng: 103.9494 },
  'changi': { lat: 1.3568, lng: 103.9886 },
  'ang mo kio': { lat: 1.3691, lng: 103.8454 },
  'bishan': { lat: 1.3505, lng: 103.8485 },
  'toa payoh': { lat: 1.3346, lng: 103.8500 },
  'serangoon': { lat: 1.3500, lng: 103.8718 },
  'hougang': { lat: 1.3713, lng: 103.8920 },
  'punggol': { lat: 1.3984, lng: 103.9072 },
  'sengkang': { lat: 1.3917, lng: 103.8953 },
  'woodlands': { lat: 1.4360, lng: 103.7865 },
  'yishun': { lat: 1.4295, lng: 103.8350 },
  'sembawang': { lat: 1.4491, lng: 103.8199 },
  'jurong east': { lat: 1.3330, lng: 103.7423 },
  'jurong west': { lat: 1.3404, lng: 103.7090 },
  'clementi': { lat: 1.3150, lng: 103.7651 },
  'buona vista': { lat: 1.3073, lng: 103.7901 },
  'holland village': { lat: 1.3117, lng: 103.7961 },
  'novena': { lat: 1.3204, lng: 103.8439 },
  'newton': { lat: 1.3138, lng: 103.8381 },
  'dhoby ghaut': { lat: 1.2988, lng: 103.8456 },
  'city hall': { lat: 1.2931, lng: 103.8519 },
  'lavender': { lat: 1.3072, lng: 103.8630 },
  'kallang': { lat: 1.3114, lng: 103.8714 },
  'aljunied': { lat: 1.3165, lng: 103.8829 },
  'paya lebar': { lat: 1.3178, lng: 103.8927 },
  'eunos': { lat: 1.3198, lng: 103.9030 },
  'kembangan': { lat: 1.3208, lng: 103.9128 },
  'simei': { lat: 1.3432, lng: 103.9532 },
  'expo': { lat: 1.3351, lng: 103.9617 },

  // Hawker Centres & Food Landmarks
  'maxwell': { lat: 1.2804, lng: 103.8447 },
  'maxwell food centre': { lat: 1.2804, lng: 103.8447 },
  'old airport road': { lat: 1.3082, lng: 103.8831 },
  'old airport road food centre': { lat: 1.3082, lng: 103.8831 },
  'amoy street': { lat: 1.2799, lng: 103.8469 },
  'amoy street food centre': { lat: 1.2799, lng: 103.8469 },
  'golden mile': { lat: 1.3025, lng: 103.8631 },
  'golden mile food centre': { lat: 1.3025, lng: 103.8631 },
  'lau pa sat': { lat: 1.2805, lng: 103.8505 },
  'tekka': { lat: 1.3066, lng: 103.8500 },
  'tekka centre': { lat: 1.3066, lng: 103.8500 },
  'chomp chomp': { lat: 1.3619, lng: 103.8664 },
  'newton food centre': { lat: 1.3120, lng: 103.8388 },
  'adam road food centre': { lat: 1.3245, lng: 103.8139 },
  'ghim moh': { lat: 1.3111, lng: 103.7883 },
  'commonwealth': { lat: 1.3020, lng: 103.7987 },
  'zion road': { lat: 1.2910, lng: 103.8295 },
  'hong lim': { lat: 1.2852, lng: 103.8452 },
  'hong lim food centre': { lat: 1.2852, lng: 103.8452 },
  'albert centre': { lat: 1.3022, lng: 103.8535 },
  'berseh food centre': { lat: 1.3073, lng: 103.8550 },
  'bendemeer': { lat: 1.3220, lng: 103.8652 },

  // Shopping Malls / Districts
  'ion orchard': { lat: 1.3039, lng: 103.8318 },
  'ngee ann city': { lat: 1.3020, lng: 103.8341 },
  'takashimaya': { lat: 1.3020, lng: 103.8341 },
  'plaza singapura': { lat: 1.3008, lng: 103.8451 },
  'suntec': { lat: 1.2940, lng: 103.8578 },
  'suntec city': { lat: 1.2940, lng: 103.8578 },
  'bugis junction': { lat: 1.2997, lng: 103.8550 },
  'bugis+': { lat: 1.3003, lng: 103.8549 },
  'vivo city': { lat: 1.2644, lng: 103.8223 },
  'vivocity': { lat: 1.2644, lng: 103.8223 },
  'harbourfront': { lat: 1.2653, lng: 103.8214 },
  'sentosa': { lat: 1.2494, lng: 103.8303 },

  // Universities / Institutions
  'nus': { lat: 1.2966, lng: 103.7764 },
  'ntu': { lat: 1.3483, lng: 103.6831 },
  'smu': { lat: 1.2973, lng: 103.8498 },
  'sutd': { lat: 1.3413, lng: 103.9637 },
};

/**
 * Look up coordinates for a location name from fallback data.
 *
 * @param locationName - The location to look up
 * @returns Coordinates if found, null otherwise
 */
export function getFallbackLocation(locationName: string): Coords | null {
  const normalized = locationName.toLowerCase().trim();

  // Direct match
  if (FALLBACK_LOCATIONS[normalized]) {
    return FALLBACK_LOCATIONS[normalized];
  }

  // Partial match - check if any key contains the search term or vice versa
  for (const [key, coords] of Object.entries(FALLBACK_LOCATIONS)) {
    if (key.includes(normalized) || normalized.includes(key)) {
      return coords;
    }
  }

  return null;
}
