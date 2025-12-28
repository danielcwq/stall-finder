CREATE TABLE IF NOT EXISTS agent_search_traces (
    id BIGSERIAL PRIMARY KEY,
    trace_id TEXT UNIQUE NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Input
    raw_query TEXT NOT NULL,
    user_location JSONB,

    -- Parsing
    parsed_query JSONB,
    parsing_latency_ms INTEGER,
    parsing_model TEXT,

    -- Geocoding
    geocoding_source TEXT,
    search_center JSONB,
    geocoding_latency_ms INTEGER,

    -- Database
    db_filters JSONB,
    db_row_count INTEGER,
    database_latency_ms INTEGER,

    -- Distance filter
    distance_radius_km REAL,
    candidates_before_distance INTEGER,
    candidates_after_distance INTEGER,

    -- Ranking
    ranked_ids TEXT[],
    ranking_reasoning TEXT,
    ranking_latency_ms INTEGER,
    ranking_model TEXT,

    -- Results
    result_count INTEGER,
    total_latency_ms INTEGER,

    -- Errors
    errors JSONB,

    -- Metadata
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_agent_traces_timestamp ON agent_search_traces(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_traces_trace_id ON agent_search_traces(trace_id);

COMMENT ON TABLE agent_search_traces IS 'Stores trace data for agent-powered searches for debugging and analytics';
