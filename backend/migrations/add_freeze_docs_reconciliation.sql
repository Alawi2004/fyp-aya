-- ============================================================
-- Migration: Wallet schema + Freeze + Vehicle Docs + Staff Reconciliation
-- ============================================================

-- 1. Core wallet table
IF OBJECT_ID('wallets', 'U') IS NULL
BEGIN
  CREATE TABLE wallets (
    wallet_id            INT IDENTITY(1,1) PRIMARY KEY,
    user_id              INT             NOT NULL UNIQUE,
    balance              DECIMAL(10,2)   NOT NULL DEFAULT 0,
    is_frozen            BIT             NOT NULL DEFAULT 0,
    freeze_reason        NVARCHAR(200)   NULL,
    freeze_notes         NVARCHAR(500)   NULL,
    frozen_at            DATETIME        NULL,
    frozen_by_admin_id   INT             NULL,
    updated_at           DATETIME        NULL
  );
END
ELSE
BEGIN
  -- Add freeze columns if wallets already exists without them
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wallets' AND COLUMN_NAME='is_frozen')
    ALTER TABLE wallets ADD is_frozen BIT NOT NULL DEFAULT 0;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wallets' AND COLUMN_NAME='freeze_reason')
    ALTER TABLE wallets ADD freeze_reason NVARCHAR(200) NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wallets' AND COLUMN_NAME='freeze_notes')
    ALTER TABLE wallets ADD freeze_notes NVARCHAR(500) NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wallets' AND COLUMN_NAME='frozen_at')
    ALTER TABLE wallets ADD frozen_at DATETIME NULL;
  IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='wallets' AND COLUMN_NAME='frozen_by_admin_id')
    ALTER TABLE wallets ADD frozen_by_admin_id INT NULL;
END

-- 2. Top-up locations (public lookup)
IF OBJECT_ID('top_up_locations', 'U') IS NULL
BEGIN
  CREATE TABLE top_up_locations (
    location_id  INT IDENTITY(1,1) PRIMARY KEY,
    name         NVARCHAR(200)  NOT NULL,
    address      NVARCHAR(300)  NULL,
    city         NVARCHAR(100)  NULL,
    phone        NVARCHAR(50)   NULL,
    hours        NVARCHAR(200)  NULL,
    is_active    BIT            NOT NULL DEFAULT 1
  );
END

-- 3. Wallet recharges (admin top-up audit)
IF OBJECT_ID('wallet_recharges', 'U') IS NULL
BEGIN
  CREATE TABLE wallet_recharges (
    recharge_id   INT IDENTITY(1,1) PRIMARY KEY,
    user_id       INT            NOT NULL,
    staff_id      INT            NOT NULL,
    amount        DECIMAL(10,2)  NOT NULL,
    location_name NVARCHAR(255)  NOT NULL,
    tx_ref        NVARCHAR(100)  NOT NULL UNIQUE,
    notes         NVARCHAR(500)  NULL,
    created_at    DATETIME       NOT NULL DEFAULT GETUTCDATE()
  );
END

-- 4. Wallet transactions (user-visible ledger)
IF OBJECT_ID('wallet_transactions', 'U') IS NULL
BEGIN
  CREATE TABLE wallet_transactions (
    transaction_id  INT IDENTITY(1,1) PRIMARY KEY,
    user_id         INT            NOT NULL,
    recharge_id     INT            NULL,
    type            NVARCHAR(20)   NOT NULL,   -- 'credit' | 'debit'
    amount          DECIMAL(10,2)  NOT NULL,
    description     NVARCHAR(500)  NULL,
    created_at      DATETIME       NOT NULL DEFAULT GETUTCDATE()
  );
END

-- 5. Wallet adjustments (admin credit/debit audit)
IF OBJECT_ID('wallet_adjustments', 'U') IS NULL
BEGIN
  CREATE TABLE wallet_adjustments (
    adjustment_id   INT IDENTITY(1,1) PRIMARY KEY,
    user_id         INT            NOT NULL,
    admin_id        INT            NOT NULL,
    type            NVARCHAR(10)   NOT NULL,   -- 'credit' | 'debit'
    amount          DECIMAL(10,2)  NOT NULL,
    reason          NVARCHAR(200)  NOT NULL,
    notes           NVARCHAR(500)  NULL,
    balance_before  DECIMAL(10,2)  NOT NULL,
    balance_after   DECIMAL(10,2)  NOT NULL,
    created_at      DATETIME       NOT NULL DEFAULT GETUTCDATE()
  );
END

-- 6. Staff top-ups (staff portal wallet recharges)
IF OBJECT_ID('staff_top_ups', 'U') IS NULL
BEGIN
  CREATE TABLE staff_top_ups (
    top_up_id              INT IDENTITY(1,1) PRIMARY KEY,
    user_id                INT            NOT NULL,
    wallet_id              INT            NULL,
    amount                 DECIMAL(10,2)  NOT NULL,
    transaction_type       NVARCHAR(50)   NOT NULL DEFAULT 'top_up',
    balance_before         DECIMAL(10,2)  NOT NULL,
    balance_after          DECIMAL(10,2)  NOT NULL,
    processed_by_staff_id  INT            NOT NULL,
    recharge_location      NVARCHAR(255)  NOT NULL,
    payment_method         NVARCHAR(100)  NOT NULL,
    transaction_reference  NVARCHAR(100)  NOT NULL UNIQUE,
    notes                  NVARCHAR(500)  NULL,
    status                 NVARCHAR(50)   NOT NULL DEFAULT 'completed',
    created_at             DATETIME       NOT NULL DEFAULT GETUTCDATE()
  );
END

-- 7. Wallet freeze audit log (NEW)
IF OBJECT_ID('wallet_freeze_log', 'U') IS NULL
BEGIN
  CREATE TABLE wallet_freeze_log (
    log_id     INT IDENTITY(1,1) PRIMARY KEY,
    user_id    INT           NOT NULL,
    action     NVARCHAR(20)  NOT NULL,   -- 'frozen' | 'unfrozen'
    reason     NVARCHAR(200) NULL,
    notes      NVARCHAR(500) NULL,
    admin_id   INT           NULL,
    created_at DATETIME      NOT NULL DEFAULT GETUTCDATE()
  );
END

-- 8. Vehicle document expiry dates (NEW)
IF OBJECT_ID('vehicle_docs', 'U') IS NULL
BEGIN
  CREATE TABLE vehicle_docs (
    plate                  NVARCHAR(50)  NOT NULL PRIMARY KEY,
    registration_expiry    DATE          NULL,
    insurance_expiry       DATE          NULL,
    roadworthiness_expiry  DATE          NULL,
    updated_at             DATETIME      NULL,
    updated_by_admin_id    INT           NULL
  );
END

-- 9. Staff shift reconciliation (NEW)
IF OBJECT_ID('staff_reconciliation', 'U') IS NULL
BEGIN
  CREATE TABLE staff_reconciliation (
    reconciliation_id    INT IDENTITY(1,1) PRIMARY KEY,
    staff_id             INT            NOT NULL,
    reconciliation_date  DATE           NOT NULL,
    expected_amount      DECIMAL(10,2)  NOT NULL DEFAULT 0,
    actual_amount        DECIMAL(10,2)  NULL,
    discrepancy          AS (actual_amount - expected_amount),
    status               NVARCHAR(50)   NOT NULL DEFAULT 'pending',
    notes                NVARCHAR(500)  NULL,
    reviewed_by          INT            NULL,
    reviewed_at          DATETIME       NULL,
    created_at           DATETIME       NOT NULL DEFAULT GETUTCDATE(),
    UNIQUE (staff_id, reconciliation_date)
  );
END

PRINT 'Migration complete.';
