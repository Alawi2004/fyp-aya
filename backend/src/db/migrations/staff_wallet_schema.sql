-- ============================================================
-- Staff Wallet Top-Up Schema Migration
-- Run once against your SQL Server database.
-- Adds the staff_top_ups table with full audit fields.
-- ============================================================

IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'staff_top_ups'
)
BEGIN
  CREATE TABLE staff_top_ups (
    -- Primary key
    top_up_id              INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,

    -- Who received the money
    user_id                INT            NOT NULL REFERENCES users(user_id),
    wallet_id              INT            NULL     REFERENCES wallets(wallet_id),

    -- Transaction financials
    amount                 DECIMAL(10,2)  NOT NULL CHECK (amount > 0),
    transaction_type       NVARCHAR(20)   NOT NULL DEFAULT 'top_up',
    balance_before         DECIMAL(10,2)  NOT NULL,
    balance_after          DECIMAL(10,2)  NOT NULL,

    -- Staff audit
    processed_by_staff_id  INT            NOT NULL REFERENCES users(user_id),

    -- Payment details
    recharge_location      NVARCHAR(255)  NOT NULL,
    payment_method         NVARCHAR(100)  NOT NULL,
    transaction_reference  NVARCHAR(100)  NOT NULL,   -- receipt / ref number

    -- Optional
    notes                  NVARCHAR(500)  NULL,

    -- Status & timestamp
    status                 NVARCHAR(20)   NOT NULL DEFAULT 'completed'
                              CHECK (status IN ('completed', 'reversed', 'pending')),
    created_at             DATETIME2      NOT NULL DEFAULT GETUTCDATE(),

    -- Prevent duplicate receipt numbers globally
    CONSTRAINT UQ_staff_top_ups_txref UNIQUE (transaction_reference)
  );

  -- Index: fast lookup by staff member (history page)
  CREATE INDEX IX_staff_top_ups_staff    ON staff_top_ups (processed_by_staff_id, created_at DESC);

  -- Index: fast lookup by user (admin audit)
  CREATE INDEX IX_staff_top_ups_user     ON staff_top_ups (user_id, created_at DESC);

  -- Index: date range queries
  CREATE INDEX IX_staff_top_ups_created  ON staff_top_ups (created_at DESC);

  PRINT 'staff_top_ups table created successfully.';
END
ELSE
BEGIN
  PRINT 'staff_top_ups already exists — skipping.';
END;
