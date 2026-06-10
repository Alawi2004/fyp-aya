-- Migration 007: Share analytics columns for tickets table
-- Stateless HMAC share tokens need no table; these columns are analytics-only.

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'tickets' AND COLUMN_NAME = 'share_count'
)
BEGIN
  ALTER TABLE tickets ADD share_count INT NOT NULL DEFAULT 0;
  PRINT 'Added share_count to tickets';
END

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = 'tickets' AND COLUMN_NAME = 'last_shared_at'
)
BEGIN
  ALTER TABLE tickets ADD last_shared_at DATETIME2 NULL;
  PRINT 'Added last_shared_at to tickets';
END
