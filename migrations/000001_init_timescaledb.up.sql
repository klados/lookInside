CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS init_connection_streamings(
                                   id BIGSERIAL,
                                   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                   deleted_at TIMESTAMPTZ,

                                   campaign_id UUID NOT NULL,
                                   session_id VARCHAR(255) NOT NULL,

                                   remote_ip_address VARCHAR(50),
                                   user_agent VARCHAR(512),
                                   language VARCHAR(100),
                                   hardware_concurrency VARCHAR(50),
                                   device_memory VARCHAR(50),
                                   max_touch_points VARCHAR(50),
                                   network_type VARCHAR(100),
                                   geolocation TEXT,
                                   cookies_enabled BOOLEAN DEFAULT FALSE,
                                   webdriver BOOLEAN DEFAULT FALSE,
                                   full_screen_enabled BOOLEAN DEFAULT FALSE,
                                   has_focus BOOLEAN DEFAULT FALSE,
                                   storage_estimate TEXT,
                                   timezone VARCHAR(100),
                                   locale_time VARCHAR(100)
                               );

-- Convert to TimescaleDB hypertable for time-series data BEFORE creating indexes
SELECT create_hypertable('init_connection_streamings', 'created_at');

-- Create a composite primary key that includes the partitioning column
ALTER TABLE init_connection_streamings ADD CONSTRAINT init_connection_streaming_pkey
    PRIMARY KEY (id, created_at);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_init_connection_streaming_data_campaign_id ON init_connection_streamings(campaign_id);
CREATE INDEX IF NOT EXISTS idx_init_connection_streaming_data_session_id ON init_connection_streamings(session_id);
CREATE INDEX IF NOT EXISTS idx_init_connection_streaming_data_deleted_at ON init_connection_streamings(deleted_at);
CREATE INDEX IF NOT EXISTS idx_init_connection_streaming_data_created_at ON init_connection_streamings(created_at);

-- Create a trigger to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_init_connection_streaming_data_updated_at
    BEFORE UPDATE ON init_connection_streamings
    FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
