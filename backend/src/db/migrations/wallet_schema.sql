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
    ('Riad El Solh Transit Hub',      '5 Riad El Solh Square',          'Beirut',         '+961 1 201010', 'Mon-Fri 06:00-20:00, Sat-Sun 08:00-18:00'),
    ('Hamra Customer Service Centre', '12 Hamra Main Street',            'Beirut',         '+961 1 202020', 'Daily 07:00-21:00'),
    ('Dora Terminal Office',          'Dora Bus Terminal, Ground Floor', 'Dora',           '+961 1 203030', 'Daily 06:00-22:00'),
    ('Jounieh Service Point',         '3 Jounieh Waterfront Road',       'Jounieh',        '+961 9 204040', 'Mon-Fri 08:00-18:00'),
    ('Antelias Agent Counter',        'Antelias Center, Shop 5',         'Antelias',       '+961 4 205050', 'Mon-Sat 09:00-19:00'),
    ('Airport Transit Kiosk',         'Terminal 1, Arrivals Hall',       'Beirut Airport', '+961 1 206060', 'Daily 05:00-23:00');
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
