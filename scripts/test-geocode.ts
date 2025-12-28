/**
 * Test script for OneMap geocoding
 *
 * Usage: npx tsx scripts/test-geocode.ts
 *
 * Make sure ONEMAP_API_TOKEN is set in .env.local
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load environment variables from .env.local
config({ path: resolve(process.cwd(), '.env.local') });

import { geocode, getGeocodingStatus } from '../utils/agent/geocode';

async function testGeocoding() {
  console.log('\n=== OneMap Geocoding Test ===\n');

  // Check configuration
  const status = getGeocodingStatus();
  console.log('Configuration:', status.message);

  if (!status.configured) {
    console.log('\nTo configure:');
    console.log('1. Get token from https://www.onemap.gov.sg/apidocs/');
    console.log('2. Add ONEMAP_API_TOKEN=your_token to .env.local');
    return;
  }

  // Test locations
  const testLocations = [
    'Bugis',
    'Maxwell Food Centre',
    'Orchard Road',
    'Changi Airport',
    'NUS',
    'Some Random Place That Does Not Exist',
  ];

  console.log('\nTesting locations:\n');

  for (const location of testLocations) {
    try {
      console.log(`📍 "${location}"`);
      const result = await geocode(location);

      if (result) {
        console.log(`   ✅ Found: ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`);
        console.log(`   Source: ${result.source}`);
        if (result.address) {
          console.log(`   Address: ${result.address}`);
        }
      } else {
        console.log(`   ❌ Not found`);
      }
      console.log('');
    } catch (error) {
      console.log(`   ⚠️ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      console.log('');
    }
  }

  console.log('=== Test Complete ===\n');
}

testGeocoding().catch(console.error);
