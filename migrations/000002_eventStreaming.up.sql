CREATE TABLE IF NOT EXISTS event_streaming (
                                 id BIGSERIAL PRIMARY KEY,
                                 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

                                 campaign_id UUID NOT NULL,
                                 session_id VARCHAR(255) NOT NULL,
                                 timestamp BIGINT NOT NULL,
                                 type INTEGER NOT NULL,
                                 data JSONB NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_event_streaming_campaign_id ON event_streaming(campaign_id);
CREATE INDEX IF NOT EXISTS idx_event_streaming_session_id ON event_streaming(session_id);

-- Add index for timestamp range queries (common for time-series data)
CREATE INDEX IF NOT EXISTS idx_event_streaming_timestamp_desc ON event_streaming(timestamp DESC);

