# Hybrid Search Implementation

## Overview
The application uses a hybrid search approach that combines text-based search with semantic (embedding-based) search to provide more relevant results.

## Search Components

### 1. Text Search (30% weight)
- Uses PostgreSQL's full-text search capabilities (`to_tsvector` and `plainto_tsquery`)
- Searches across:
  - Restaurant name
  - Cuisine type
  - Recommended dishes
- Example: Query "spicy noodles" will directly match restaurants with these words in their details

### 2. Semantic Search (70% weight)
- Uses OpenAI's text-embedding-3-small model
- Converts search query into a vector embedding
- Compares against pre-stored restaurant embeddings
- Can understand contextual relationships:
  - "cheap" matches with "affordable"
  - "authentic" matches with "traditional"
  - "spicy" matches with "hot" or "szechuan"

### 3. Distance Weighting
Final ranking uses an exponential decay formula: `similarity_score exp(-distance / 10)`
This means:
- A restaurant 0km away: No penalty
- A restaurant 5km away: Score reduced by ~39%
- A restaurant 10km away: Score reduced by ~63%

## Example Scoring
Query: "spicy noodles in chinatown"

Restaurant A:
- Text match (0.8 × 0.3) = 0.24 (matches "noodles" exactly)
- Semantic match (0.9 × 0.7) = 0.63 (understands "spicy" context)
- Base score: 0.87
- If 2km away: Final score = 0.87 * exp(-2/10) = 0.70

Restaurant B:
- Text match (0.6 × 0.3) = 0.18 (partial matches)
- Semantic match (0.7 × 0.7) = 0.49 (related context)
- Base score: 0.67
- If 1km away: Final score = 0.67 * exp(-1/10) = 0.61

## Results Limit
- Returns top 5 results ordered by final weighted score

## Technical Implementation

### PostgreSQL Function
The hybrid search is implemented using a PostgreSQL function that:
1. Combines text search using `to_tsvector` and `plainto_tsquery`
2. Uses vector similarity with the `<=>` operator for semantic search
3. Calculates geographic distance using PostGIS
4. Weights and combines all factors for final ranking

### Search Process
1. User enters a free-text query
2. Query is processed in two ways:
   - Direct text search in PostgreSQL
   - Converted to embedding via OpenAI API
3. Both searches run simultaneously in the database
4. Results are combined using weighted scoring
5. Distance decay is applied
6. Top 5 results are returned

### Match Conditions
A restaurant will appear in results if it meets either:
- Text match: Words in query match restaurant details
- Semantic match: Embedding similarity > 0.3 (match_threshold)

## Search Modes
The application offers two search modes:
1. Guided Search (Default)
   - Structured inputs for cuisine, price, etc.
2. Free Search ("I'm Feeling Lucky")
   - Single text input
   - Uses full hybrid search capabilities

## Performance Considerations
- PostGIS used for efficient geographic calculations
- Text search uses PostgreSQL indices
- Vector similarity uses pgvector indices
- Results limited to 5 for performance and usability