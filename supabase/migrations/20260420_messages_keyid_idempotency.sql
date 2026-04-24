-- Enforce webhook idempotency by keyId stored in raw_message JSONB.
-- Safe to run multiple times.
-- 1) Remove duplicated keyId rows (keep oldest created_at/id)
-- 2) Create unique partial index for user messages.

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY raw_message->>'keyId'
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM messages
  WHERE role = 'user'
    AND raw_message IS NOT NULL
    AND raw_message ? 'keyId'
    AND nullif(raw_message->>'keyId', '') IS NOT NULL
)
DELETE FROM messages
WHERE id IN (
  SELECT id
  FROM ranked
  WHERE rn > 1
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_user_keyid_unique
ON messages ((raw_message->>'keyId'))
WHERE role = 'user'
  AND raw_message IS NOT NULL
  AND raw_message ? 'keyId'
  AND nullif(raw_message->>'keyId', '') IS NOT NULL;
