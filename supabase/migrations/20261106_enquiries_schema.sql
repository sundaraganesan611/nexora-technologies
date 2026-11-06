-- ============================================================
-- Nexora Technologies - Database Schema, Security & Rate Limiter
-- ============================================================

-- 1. PUBLIC ENQUIRIES TABLE
CREATE TABLE IF NOT EXISTS public.enquiries (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    service TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'New',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::TEXT, NOW()) NOT NULL
);

-- Index for ordering by creation date
CREATE INDEX IF NOT EXISTS idx_enquiries_created_at 
ON public.enquiries (created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.enquiries ENABLE ROW LEVEL SECURITY;

-- Block anonymous access completely
-- Only authenticated administrators can read and update enquiries
CREATE POLICY "Admins can view enquiries"
ON public.enquiries
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can update enquiry status"
ON public.enquiries
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Revoke public insert: insertion is done safely via Supabase Edge Function using service_role
REVOKE INSERT ON public.enquiries FROM anon, authenticated;


-- 2. PRIVATE SCHEMA & RATE LIMIT TABLE
CREATE SCHEMA IF NOT EXISTS private;

-- Restrict private schema access to service_role only
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT ALL ON SCHEMA private TO service_role;

CREATE TABLE IF NOT EXISTS private.enquiry_rate_limits (
    ip_hash TEXT NOT NULL,
    bucket_start TIMESTAMP WITH TIME ZONE NOT NULL,
    request_count INT NOT NULL DEFAULT 1,
    PRIMARY KEY (ip_hash, bucket_start)
);

REVOKE ALL ON TABLE private.enquiry_rate_limits FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE private.enquiry_rate_limits TO service_role;


-- 3. ATOMIC RATE LIMIT FUNCTION
-- Increments request count for the given IP hash in a 10-minute bucket.
-- Returns TRUE if request is within limit, FALSE if limit exceeded.
CREATE OR REPLACE FUNCTION public.consume_enquiry_rate_limit(
    p_ip_hash TEXT,
    p_limit INT DEFAULT 3
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
DECLARE
    v_bucket_start TIMESTAMP WITH TIME ZONE;
    v_current_count INT;
BEGIN
    -- Calculate 10-minute bucket boundary
    v_bucket_start := DATE_TRUNC('hour', NOW()) + 
        (FLOOR(EXTRACT(MINUTE FROM NOW()) / 10) * 10) * INTERVAL '1 minute';

    -- Atomic upsert: insert or increment request count
    INSERT INTO private.enquiry_rate_limits (ip_hash, bucket_start, request_count)
    VALUES (p_ip_hash, v_bucket_start, 1)
    ON CONFLICT (ip_hash, bucket_start)
    DO UPDATE SET request_count = private.enquiry_rate_limits.request_count + 1
    RETURNING request_count INTO v_current_count;

    -- Return true if within limit, false otherwise
    RETURN v_current_count <= p_limit;
END;
$$;

-- Secure function execution permissions
REVOKE ALL ON FUNCTION public.consume_enquiry_rate_limit(TEXT, INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_enquiry_rate_limit(TEXT, INT) TO service_role;
