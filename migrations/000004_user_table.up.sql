-- Ensure UUID generation function is available
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create users table based on the User struct
CREATE TABLE IF NOT EXISTS users (
                                     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                                     email VARCHAR(255) NOT NULL UNIQUE,
                                     name VARCHAR(100) NOT NULL,
                                     picture VARCHAR(500),
                                     is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
                                     role VARCHAR(50) NOT NULL DEFAULT 'user',
                                     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                     updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                                     deleted_at TIMESTAMPTZ NULL,
                                     CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'))
);

-- Indexes to match GORM tags
CREATE INDEX IF NOT EXISTS idx_users_is_blocked ON users (is_blocked);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users (deleted_at);