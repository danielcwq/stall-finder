# Ho Jiak Bo? - Singapore Hawker Food Finder

A food discovery app that helps you find great hawker stalls from popular food blogs in Singapore.

## Features

- **Guided Search** - Filter by cuisine, distance, and price
- **Free Search** - Natural language queries with Cohere reranking
- **Agent Search** - LLM-powered search with location understanding (Beta)

## Routes

| Route | Description |
|-------|-------------|
| `/` | Production search with Cohere rerank |
| `/compare` | A/B testing (embedding vs rerank) |
| `/agent` | Agent-powered natural language search |

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Database**: Supabase (PostgreSQL + pgvector)
- **Search**: OpenAI embeddings, Cohere reranking
- **Agent**: Cohere LLM (command-a-03-2025)
- **Geocoding**: OneMap API (Singapore)

## Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Set environment variables:

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
OPENAI_API_KEY=
COHERE_API_KEY=
ONEMAP_API_TOKEN=
NEXT_PUBLIC_GA_ID=  # Optional
```

4. Run development server: `npm run dev`

## Search Methods

### Embedding + Rerank (Default)
1. Generate query embedding via OpenAI
2. Vector similarity search in Supabase
3. Rerank results using Cohere for better relevance

### Agent Search (Beta)
1. LLM parses natural language query
2. Geocode location names (OneMap API)
3. Filter database by cuisine/price
4. LLM ranks candidates with reasoning