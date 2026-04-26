-- ============================================================
-- Wallet Schema Migration
-- Run once against your SQL Server database.
-- ============================================================

-- ── wallets ──────────────────────────────────────────────────
-- One row per user.  Balance is updated atomically via transactions.
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'wallets'
)
BEGIN
  CREATE TABLE wallets (
    wallet_id   INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id     INT            NOT NULL UNIQUE REFERENCES users(user_id) ON DELETE CASCADE,
    balance     DECIMAL(10,2)  NOT NULL DEFAULT 0.00,
    updated_at  DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );
END;

-- ── top_up_locations ──────────────────────────────────────────
-- Approved physical top-up points shown to passengers in the app.
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'top_up_locations'
)
BEGIN
  CREATE TABLE top_up_locations (
    location_id  INT           NOT NULL IDENTITY(1,1) PRIMARY KEY,
    name         NVARCHAR(255) NOT NULL,
    address      NVARCHAR(500) NOT NULL,
    city         NVARCHAR(100) NOT NULL,
    phone        NVARCHAR(50)  NULL,
    hours        NVARCHAR(255) NULL,
    is_active    BIT           NOT NULL DEFAULT 1
  );

  -- Seed with initial locations
  INSERT INTO top_up_locations (name, address, city, phone, hours) VALUES
    ('Central Bus Station — Main Office', '1 Station Road',              'City Center',   '+1 555-0100', 'Mon–Fri 7:00 AM – 8:00 PM, Sat–Sun 8:00 AM – 6:00 PM'),
    ('North Terminal Customer Service',   '45 North Ave',                'North District','+1 555-0101', 'Daily 6:00 AM – 10:00 PM'),
    ('Airport Transit Hub Kiosk',         'Terminal 2, Departures Level','Airport',       '+1 555-0102', 'Daily 5:00 AM – 11:00 PM'),
    ('Mall Junction Agent Counter',       'Ground Floor, Grand Mall',    'South District','+1 555-0103', 'Mon–Sun 10:00 AM – 9:00 PM');
END;

-- ── wallet_recharges ──────────────────────────────────────────
-- Audit record for every in-person cash top-up.
-- Written by admin/staff after receiving payment.
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'wallet_recharges'
)
BEGIN
  CREATE TABLE wallet_recharges (
    recharge_id   INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id       INT            NOT NULL REFERENCES users(user_id),
    staff_id      INT            NOT NULL REFERENCES users(user_id),
    amount        DECIMAL(10,2)  NOT NULL,
    location_name NVARCHAR(255)  NOT NULL,
    tx_ref        NVARCHAR(100)  NOT NULL UNIQUE,   -- external payment reference
    notes         NVARCHAR(500)  NULL,
    created_at    DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );

  CREATE INDEX IX_wallet_recharges_user    ON wallet_recharges (user_id);
  CREATE INDEX IX_wallet_recharges_staff   ON wallet_recharges (staff_id);
  CREATE INDEX IX_wallet_recharges_created ON wallet_recharges (created_at DESC);
END;

-- ── wallet_transactions ───────────────────────────────────────
-- User-visible ledger rows (debits for trips + credits for recharges).
IF NOT EXISTS (
  SELECT 1 FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_NAME = 'wallet_transactions'
)
BEGIN
  CREATE TABLE wallet_transactions (
    transaction_id INT            NOT NULL IDENTITY(1,1) PRIMARY KEY,
    user_id        INT            NOT NULL REFERENCES users(user_id),
    recharge_id    INT            NULL     REFERENCES wallet_recharges(recharge_id),
    type           NVARCHAR(20)   NOT NULL CHECK (type IN ('credit','debit')),
    amount         DECIMAL(10,2)  NOT NULL,
    description    NVARCHAR(500)  NULL,
    created_at     DATETIME2      NOT NULL DEFAULT GETUTCDATE()
  );

  CREATE INDEX IX_wallet_tx_user    ON wallet_transactions (user_id);
  CREATE INDEX IX_wallet_tx_created ON wallet_transactions (created_at DESC);
END;
