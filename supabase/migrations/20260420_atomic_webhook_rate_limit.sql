-- Atomic per-phone per-minute rate limit for webhook.
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS webhook_rate_limits (
  phone text NOT NULL,
  window_start timestamptz NOT NULL,
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (phone, window_start)
);

ALTER TABLE webhook_rate_limits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'webhook_rate_limits'
      AND policyname = 'service_role full access'
  ) THEN
    CREATE POLICY "service_role full access" ON webhook_rate_limits
      FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION check_and_increment_webhook_rate_limit(
  p_phone text,
  p_limit integer DEFAULT 20
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_window timestamptz := date_trunc('minute', now());
  current_count integer;
BEGIN
  INSERT INTO webhook_rate_limits (phone, window_start, count, updated_at)
  VALUES (p_phone, current_window, 1, now())
  ON CONFLICT (phone, window_start)
  DO UPDATE
    SET count = webhook_rate_limits.count + 1,
        updated_at = now()
  RETURNING count INTO current_count;

  RETURN current_count <= p_limit;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_webhook_rate_limits_window_start
  ON webhook_rate_limits (window_start);
