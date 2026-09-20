CREATE TABLE IF NOT EXISTS campaigns (
     id UUID PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     domains VARCHAR(1000) NOT NULL,
     "limit" INTEGER NOT NULL,
     start_date_time BIGINT NOT NULL,
     end_date_time BIGINT NOT NULL,

     user_id UUID NOT NULL,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster lookups by user
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns (user_id);


CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Set default for the id column so it auto-generates
ALTER TABLE campaigns
    ALTER COLUMN id SET DEFAULT gen_random_uuid();

--      -   -     ALTER TABLE event_streaming
    --     ADD CONSTRAINT fk_event_streaming_campaign
    --         FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    --             ON DELETE CASCADE
    --             ON UPDATE CASCADE;
    --
    -- ALTER TABLE init_connection_streamings
    --     ADD CONSTRAINT fk_init_connection_streamings_campaign
    --         FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
    --             ON DELETE CASCADE
    --             ON UPDATE CASCADE;